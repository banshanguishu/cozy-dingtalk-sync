const { COLLECTION_TYPE_NAMES_DEV, COLLECTION_MAP } = require("./mapping/collectionMap");

/* 名称处理 */
const getSplitNameFirst = (name = "") => {
  return name.split(" ")[0];
};

/* 日期处理 */
const DateHandler = (date = "") => {
  if (!date || isNaN(Date.parse(date))) return "";
  if (date.indexOf("T") !== -1) return date.split("T")[0];
  return date;
};

/* 尺寸数值计算：支持空串、整数、小数、分数 */
const calculateDimension = (val1 = "", val2 = "") => {
  const parse = (v) => {
    if (!v) return 0;
    const str = String(v).trim();
    if (!str) return 0;

    // 1. 尝试直接转换为数字 (处理 "12", "10.5")
    const num = Number(str);
    if (!isNaN(num)) return num;

    // 2. 处理分数形式 (处理 "1/2")
    if (str.includes("/")) {
      const [numerator, denominator] = str.split("/").map(Number);
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }

    return 0;
  };

  // 两个值相加，并处理浮点数精度问题 (保留3位小数以防万一)
  const result = parse(val1) + parse(val2);
  return Math.round(result * 1000) / 1000;
};

/* 根据type类型构造不同三级订单子项，所要呈现的字段内容不同 */
const buildThirdItem = (type, customAttributes, node) => {
  if (!COLLECTION_TYPE_NAMES_DEV.includes(type)) return null;
  // 折扣码
  let discountCode = "/";
  if (node.discountAllocations && node.discountAllocations.length > 0) {
    discountCode = node.discountAllocations[0].discountApplication?.title;
  }
  if (type === "drapery") {
    return {
      collection: getSplitNameFirst(customAttributes["Collection"] || node.product.title || node.title) || "/", // collection name
      color: customAttributes["Color"] || node.variantTitle || "/",
      width: calculateDimension(customAttributes["Single Panel Order Width (inch)"], customAttributes["Width Fraction (optional)"]),
      length: calculateDimension(customAttributes["Single Panel Order Length (inch)"], customAttributes["Length Fraction (optional)"]),
      header: customAttributes["Pleat Position"] || customAttributes["Header Style (Hooks included)"] || customAttributes["Header Style"] || "/",
      liner: customAttributes["Lining"] || customAttributes["Liner Blackout Level"] || "Unlined",
      ringColor: customAttributes["Rings"] || "NA",
      tieBack: customAttributes["Tieback"] || "/",
      memoryShape: customAttributes["Memory Shape"] || "Unknown",
      roomDescription: customAttributes["Room Description (Optional)"] || "/",
      trimColor: customAttributes["Trim Color"] || "/",
    };
  } else if (type === "roman_shade") {
    return {
      collection: getSplitNameFirst(customAttributes["Collection"] || node.product.title || node.title) || "/",
      color: customAttributes["Color"] || node.variantTitle || "/",
      width: calculateDimension(customAttributes["Shade Width (inch)"], customAttributes["Width Fraction (optional)"]),
      length: calculateDimension(customAttributes["Shade Length (inch)"], customAttributes["Length Fraction (optional)"]),
      liner: customAttributes["Lining"] || customAttributes["Liner Blackout Level"] || "Unlined",
      liftType: customAttributes["Lift Type"] || "/",
      foldStyle: customAttributes["Fold Style"] || "/",
      trimColor: customAttributes["Trim Color"] || "/",
      remote: customAttributes["Remote Control"] || "/",
      hub: customAttributes["Select Connect"] || "/",
      cordColor: customAttributes["Cord Style"] || "/",
      cordPosition: customAttributes["Cord Loop Position"] || "/",
    };
  } else if (type === "hardware") {
    const getColorOrLenthSku = (type) => {
      if (customAttributes[type]) return customAttributes[type];
      if (node.variant.selectedOptions.length > 0) {
        const t = node.variant.selectedOptions.find((item) => item.name === type);
        if (t) return t.value;
      }
      if (node.variantTitle || node.variant.title) {
        const tle = node.variantTitle || node.variant.title;
        if (tle.includes("/")) {
          const split = tle.split("/");
          return type === "Color" ? split[0] : split[1];
        }
        return "/";
      }
      return "/";
    };
    return {
      productName: node.title || node.product?.title || "/",
      discountCode,
      colorSku: getColorOrLenthSku("Color"),
      sizeSku: getColorOrLenthSku("Length (inch)"),
      capStyle: customAttributes["Cap Style"] || "/",
      runnerType: customAttributes["Runner Type"] || "/",
      powerType: customAttributes["Power Type"] || "/",
      holdbackStyle: customAttributes["Holdback Style"] || "/",
    };
  } else if (type === "hanwoven_shade") {
    return {
      collection: getSplitNameFirst(customAttributes["Collection"] || node.product.title || node.title) || "/",
      color: customAttributes["Color"] || node.variantTitle || "/",
      liftType: customAttributes["Lift Type"] || "/",
      cordColor: customAttributes["Cord Style"] || "/",
      cordLoopPosition: customAttributes["Cord Loop Position"] || "/",
      width: calculateDimension(customAttributes["Shade Width (inches)"], customAttributes["Width Fraction (optional)"]),
      length: calculateDimension(customAttributes["Shade Length (inches)"], customAttributes["Length Fraction (optional)"]),
      lining: customAttributes["Lining"] || "/",
      edgeBinding: customAttributes["Edge Binding"] || "/",
      remoteControl: customAttributes["Remote Control"] || "/",
      hub: customAttributes["Select Connect"] || "/",
      roomDescription: customAttributes["Room Description (Optional)"] || "/",
    };
  }
};

/* 根据原始订单数据构造三级订单对象数组 */
const buildThirdOrders = (orders, type) => {
  try {
    if (!COLLECTION_TYPE_NAMES_DEV.includes(type)) {
      throw new Error(`❌ 根据原始一级订单数据构造三级订单数据时，缺少collection type字段或者字段值不正确，程序终止！当前type：${type}`);
    }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return [];
    }

    const { id: targetTypeId, suffix: targetTypeSuffix, sourceKeyWord: targetTypeSource } = COLLECTION_MAP[type];
    const thirdOrder = [];

    for (const o of orders) {
      if (!o.lineItems?.edges || !Array.isArray(o.lineItems.edges)) continue;

      const currentOrders = [];
      const parentName = o.name.startsWith("#") ? o.name.slice(1) : o.name;

      for (const chil of o?.lineItems?.edges || []) {
        const node = chil.node || {};

        // 根据商品的所属合集是否包含我们要查询的 type集合类型 来判断该商品是不是符合要求的。
        // 商品有一个collections集合，如果里面存在对应type（通过id判断）的collection，则这个商品是需要返回的商品
        const isTargetTypeProduct = (node?.product?.collections?.edges || []).findIndex((coll) => {
          return (coll.node.id || "").endsWith(targetTypeId);
        });
        if (isTargetTypeProduct === -1) continue;

        // 规范化一下当前商品的自定义属性
        const customAttributes = {};
        if (node.customAttributes?.length) {
          node.customAttributes.forEach(({ key, value }) => {
            const k = key.trim();
            customAttributes[k] = value;
          });
        }

        // 公共字段，从最外层订单对象身上获取，即一级订单的信息
        const commonField = {
          devTypeId: targetTypeId, // 存储当前商品所属类型，在进行二级订单合并的时候可能有用.
          parentId: o.id, // 一级订单id
          parentName: parentName, // 一级订单号
          thirdId: node.id, // 三级订单id
          thirdName: parentName + targetTypeSuffix + (currentOrders.length + 1), // 三级订单号
          quantity: node.quantity || 0, // 商品数量
          createdAt: DateHandler(o.createdAt), // 订单创建时间
          updatedAt: DateHandler(o.updatedAt), // 订单更新时间
          note: o.note || "/",
          source: targetTypeSource, // 重要：这是同步数据到钉钉多维表必需的关键字
        };
        const thirdOrderField = buildThirdItem(type, customAttributes, node);
        currentOrders.push(thirdOrderField ? { ...commonField, ...thirdOrderField } : commonField);
      }

      thirdOrder.push(...currentOrders);
    }

    return thirdOrder;
  } catch (error) {
    console.error(error);
    return [];
  }
};

module.exports = {
  buildThirdOrders,
};
