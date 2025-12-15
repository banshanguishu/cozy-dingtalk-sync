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

/* 根据不同 */

/* 根据原始订单数据构造三级订单对象数组 */
const buildThirdOrders = (orders, type) => {
  try {
    if (!COLLECTION_TYPE_NAMES_DEV.includes(type)) {
      throw new Error("❌ 根据原始一级订单数据构造三级订单数据时，缺少collection type字段或者字段值不正确，程序终止！");
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
        const isTargetTypeProduct = (node?.product?.collections?.edges || []).findIndex((coll) => {
          return (coll.node.id || "").endsWith(targetTypeId);
        });

        if (isTargetTypeProduct === -1) continue;

        const customAttributes = {};
        if (node.customAttributes?.length) {
          node.customAttributes.forEach(({ key, value }) => {
            const k = key.trim();
            customAttributes[k] = value;
          });
        }

        const thirdOrderItem = {
          devTypeId: targetTypeId, // 存储当前商品所属类型，在进行二级订单合并的时候可能有用
          parentId: o.id, // 一级订单id
          parentName: parentName, // 一级订单号
          thirdId: node.id, // 三级订单id
          thirdName: parentName + targetTypeSuffix + (currentOrders.length + 1), // 三级订单号
          createdAt: DateHandler(o.createdAt), // 订单创建时间
          updatedAt: DateHandler(o.updatedAt), // 订单更新时间
          quantity: node.quantity, // 商品数量
          collection: getSplitNameFirst(customAttributes["Collection"] || node.product.title || node.title), // collection name
          color: customAttributes["Trim Color"] || node.variantTitle || "",
          width: Number(customAttributes["Single Panel Order Width (inch)"] || 0) + Number(customAttributes["Width Fraction (optional)"] || 0),
          length: Number(customAttributes["Single Panel Order Length (inch)"] || 0) + Number(customAttributes["Length Fraction (optional)"] || 0),
          header: customAttributes["Pleat Position"] || customAttributes["Header Style (Hooks included)"] || customAttributes["Header Style"] || "",
          liner: customAttributes["Lining"] || customAttributes["Liner Blackout Level"] || "Unlined",
          ringColor: customAttributes["Rings Color"] || "",
          tieBack: customAttributes["Tieback"] || "",
          memoryShape: customAttributes["Memory Shape"] || "no memory shape",
          roomDescription: customAttributes["Room Description (Optional)"] || "",
          trimColor: customAttributes["Trim Color"] || "",
          source: targetTypeSource, // 重要：这是同步数据到钉钉多维表必需的关键字
        };

        currentOrders.push(thirdOrderItem);
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
