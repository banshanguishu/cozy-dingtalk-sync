const { COLLECTION_TYPE_NAMES_DEV, COLLECTION_MAP, COLLECTION_TYPE_IDS, COLLECTION_ID_MAP_CONFIG } = require("./mapping/collectionMap");
const { formatWestCoastDate } = require("./utils");
const OTHERS_FALLBACK_BASE_TYPES = ["drapery", "roman_shade", "hardware", "hanwoven_shade", "roller_blind", "other_shade", "free_swatches"];
const OTHERS_FALLBACK_BASE_COLLECTION_IDS = OTHERS_FALLBACK_BASE_TYPES.map((type) => COLLECTION_MAP[type]?.id).filter(Boolean);
const FREE_SWATCHES_COLLECTION_ID = "499489243454";
// others 分支需要额外排除的伪商品 title：仅当 lineItem 的 product 为 null（即 Shopify 后台没有对应商品、
// 是结账时临时添加的自定义收费条目）且 title 命中本名单时才剔除，避免误伤真实 Shopify 商品恰好叫同名的情况
const OTHERS_EXCLUDE_PSEUDO_TITLES = new Set(["Tip"]);

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

/* 去掉前缀 # 获取单号 */
const getOrderNumber = (name = "") => {
  return name.startsWith("#") ? name.slice(1) : name;
};

/* 根据type类型构造不同三级订单子项，所要呈现的字段内容不同 */
const buildThirdItem = (type, customAttributes, node) => {
  if (!COLLECTION_TYPE_NAMES_DEV.includes(type)) return null;
  // 折扣码
  let discountCode = "/";
  if (node.discountAllocations && node.discountAllocations.length > 0) {
    const discountCodes = node.discountAllocations
      .map((item) => {
        const discountApplication = item.discountApplication || {};
        const { __typename, code, title } = discountApplication;
        if (__typename === "DiscountCodeApplication") {
          return code || title || "";
        }
        if (__typename === "AutomaticDiscountApplication" || __typename === "ManualDiscountApplication") {
          return title || code || "";
        }
        return code || title || "";
      })
      .filter(Boolean);

    if (discountCodes.length > 0) {
      discountCode = [...new Set(discountCodes)].join(";");
    }
  }
  if (type === "drapery") {
    return {
      collection: getSplitNameFirst(customAttributes["Collection"] || node.product.title || node.title) || "/", // collection name
      discountCode,
      color: customAttributes["Color"] || node.variantTitle || "/",
      width: calculateDimension(customAttributes["Single Panel Order Width (inch)"], customAttributes["Width Fraction (optional)"]),
      length: calculateDimension(customAttributes["Single Panel Order Length (inch)"], customAttributes["Length Fraction (optional)"]),
      header: customAttributes["Pleat Position"] || customAttributes["Header Style (Hooks included)"] || customAttributes["Header Style"] || "/",
      liner: customAttributes["Lining"] || customAttributes["Liner Blackout Level"] || "Unlined",
      ringColor: customAttributes["Rings"] || customAttributes["Grommet Color"] || "NA",
      tieBack: customAttributes["Tieback"] || "/",
      memoryShape: customAttributes["Memory Shape"] || "Unknown",
      roomDescription: customAttributes["Room Description (Optional)"] || "/",
      trimColor: customAttributes["Trim Color"] || "/",
    };
  } else if (type === "roman_shade") {
    return {
      collection: getSplitNameFirst(customAttributes["Collection"] || node.product.title || node.title) || "/",
      discountCode,
      color: customAttributes["Color"] || node.variantTitle || "/",
      width: calculateDimension(customAttributes["Shade Width (inch)"], customAttributes["Width Fraction (optional)"]),
      length: calculateDimension(customAttributes["Shade Length (inch)"], customAttributes["Length Fraction (optional)"]),
      liner: customAttributes["Lining"] || customAttributes["Liner Blackout Level"] || "Unlined",
      liftType: customAttributes["Lift Type"] || "/",
      foldStyle: customAttributes["Fold Style"] || "/",
      trimColor: customAttributes["Trim Color"] || "/",
      remote: customAttributes["Remote Control"] || "/",
      hub: customAttributes["Select Connect"] || "/",
      installMethod: customAttributes["Installation Method"] || "/",
      cordColor: customAttributes["Cord Style"] || "/",
      cordPosition: customAttributes["Cord Loop Position"] || "/",
      roomDescription: customAttributes["Room Description (Optional)"] || "/",
    };
  } else if (type === "hardware") {
    const getColorOrLenthSku = (type) => {
      if (customAttributes[type]) {
        if (type === "Length (inch)") {
          return calculateDimension(customAttributes[type], customAttributes["Length Fraction (optional)"]) || "";
        }
        return customAttributes[type];
      }
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
      bracketStyle: customAttributes["Bracket Style"] || "/",
      size: customAttributes["Size"] || "/",
      runnerType: customAttributes["Runner Type"] || "/",
      powerType: customAttributes["Power Type"] || "/",
      holdbackStyle: customAttributes["Holdback Style"] || "/",
      mountingType: customAttributes["Mounting Type"] || "/",
      roomDescription: customAttributes["Room Description (Optional)"] || "/",
    };
  } else if (type === "hanwoven_shade") {
    return {
      collection: getSplitNameFirst(customAttributes["Collection"] || node.product.title || node.title) || "/",
      discountCode,
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
  } else if (type === "roller_blind" || type === "other_shade") {
    return {
      color: customAttributes["Color"] || node.variantTitle || "/",
      liftType: customAttributes["Lift Type"] || "/",
      cordedOptions: customAttributes["Corded Options"] || "/",
      cordLoopPosition: customAttributes["Cord Loop Positions"] || "/",
      width: calculateDimension(customAttributes["Shade Width (inches)"], customAttributes["Width Fraction (optional)"]),
      height: calculateDimension(customAttributes["Shade Length (inches)"], customAttributes["Length Fraction (optional)"]),
      remoteControl: customAttributes["Remote Control"] || "/",
      hub: customAttributes["Select Connect"] || "/",
      roomDescription: customAttributes["Room Description (Optional)"] || "/",
      discountCode,
    };
  } else if (type === "others") {
    return {
      productName: node.title || node.product?.title || "/",
      discountCode,
    };
  }
};

/* 根据原始订单数据构造三级订单对象数组 */
const buildThirdOrders = (orders, type) => {
  try {
    if (!COLLECTION_TYPE_NAMES_DEV.includes(type)) {
      throw new Error(
        `❌ 未知的 collection type: ${type}`,
      );
    }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return [];
    }

    const { id: targetTypeId, suffix: targetTypeSuffix, sourceKeyWord: targetTypeSource } = COLLECTION_MAP[type];
    const thirdOrder = [];

    for (const o of orders) {
      if (!o.lineItems?.edges || !Array.isArray(o.lineItems.edges)) continue;

      const currentOrders = [];
      const parentName = getOrderNumber(o.name);

      for (const chil of o?.lineItems?.edges || []) {
        const node = chil.node || {};

        // 根据商品的所属合集是否包含我们要查询的 type集合类型 来判断该商品是不是符合要求的。
        // 商品有一个collections集合，如果里面存在对应type（通过id判断）的collection，则这个商品是需要返回的商品
        const collectionIds = (node?.product?.collections?.edges || []).map((coll) => coll?.node?.id || "");
        const isPseudoExcludedItem = !node.product && OTHERS_EXCLUDE_PSEUDO_TITLES.has(node.title);
        const isTargetTypeProduct =
          type === "others"
            ? !isPseudoExcludedItem &&
              !collectionIds.some((id) => OTHERS_FALLBACK_BASE_COLLECTION_IDS.some((baseId) => id.endsWith(baseId)))
            : collectionIds.some((id) => id.endsWith(targetTypeId));
        if (!isTargetTypeProduct) continue;

        // 规范化一下当前商品的自定义属性
        const customAttributes = {};
        if (node.customAttributes?.length) {
          node.customAttributes.forEach(({ key, value }) => {
            const k = key.trim();
            const v = typeof value === "string" ? value.trim() : value;
            customAttributes[k] = v;
          });
        }

        const address2Keys = ["city", "provinceCode", "zip"];
        const getShippingAddress = (addressInfo) => {
          const info = addressInfo && typeof addressInfo === "object" ? addressInfo : {};
          const lines = [];

          const normalize = (val) => {
            if (val === null || val === undefined) return "";
            const str = String(val).trim();
            return str;
          };

          const addIfHasValue = (val) => {
            const v = normalize(val);
            if (v) lines.push(v);
          };

          addIfHasValue(info.name);
          addIfHasValue(info.address1);

          const address2ByParts = address2Keys
            .map((k) => normalize(info[k]))
            .filter(Boolean)
            .join(" ");
          const address2 = address2ByParts || normalize(info.address2);
          addIfHasValue(address2);

          addIfHasValue(info.country);
          addIfHasValue(info.phone);

          return lines.join("\n");
        };

        // 公共字段，从最外层s订单对象身上获取，即一级订单的信息
        const customerFirstName = (o.customer?.firstName || "").trim();
        const customerLastName = (o.customer?.lastName || "").trim();
        const customerName = customerFirstName && customerLastName ? `${customerFirstName} ${customerLastName}` : o.customer?.displayName || "/";
        const commonField = {
          devTypeId: type === "others" ? "others" : targetTypeId, // 存储当前商品所属类型，在进行二级订单合并的时候可能有用
          parentId: o.id, // 一级订单id
          parentName: parentName, // 一级订单号
          thirdId: node.id, // 三级订单id
          thirdName: parentName + targetTypeSuffix + (currentOrders.length + 1), // 三级订单号
          quantity: node.quantity || 0, // 商品数量
          createdAt: DateHandler(o.createdAt), // 订单创建时间
          updatedAt: DateHandler(o.updatedAt), // 订单更新时间
          note: o.note || "/",
          customerName: customerName, // 客户名称
          email: o.email || "/", // 客户邮箱
          shippingAddress: getShippingAddress({
            ...(o.shippingAddress || {}),
            phone: o.customer?.phone || o.shippingAddress?.phone,
          }),
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

/* 获取商品所属合集类型id */
const getProductCollectionId = (edges) => {
  if (!edges || !Array.isArray(edges) || edges.length === 0) return "other";
  const ids = edges.map((edge) => (edge.node?.id || "").split("/").pop());
  if (ids.length === 0) return "other";
  let id = "",
    count = 0;
  COLLECTION_TYPE_IDS.forEach((typeId) => {
    // 合集类型id 只能有一个，否则返回空字符串
    if (ids.includes(typeId)) {
      id = typeId;
      count++;
    }
  });
  return count === 1 ? id : "other";
};

/* 判断商品是否被移除 */
const isRemoved = (node) => {
  const quantity = Number(node.quantity) || 0;
  const currentQuantity = Number(node.currentQuantity) || 0;
  if (quantity > 0 && currentQuantity === 0) return true;
  return false;
};

const roundTo2 = (num) => {
  const n = Number(num);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const getGiftCardDeductionAmount = (order) => {
  const transactions = Array.isArray(order?.transactions) ? order.transactions : [];
  if (transactions.length === 0) return 0;

  const seenPaymentIds = new Set();

  return transactions.reduce((sum, transaction) => {
    if (transaction?.gateway !== "gift_card") return sum;
    if (transaction?.status !== "SUCCESS") return sum;
    if (transaction?.kind !== "CAPTURE") return sum;

    const paymentId = transaction?.paymentId;
    if (!paymentId || seenPaymentIds.has(paymentId)) return sum;
    seenPaymentIds.add(paymentId);

    const amount = Number(transaction?.amountSet?.shopMoney?.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
};

/* 构造二级订单对象 */
const buildSecondOrders = (orders, type = "secondary_order", usdToRmbRate = null) => {
  try {
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return [];
    }

    const { sourceKeyWord: targetTypeSource } = COLLECTION_MAP[type] || {};

    const result = [];

    for (const o of orders) {
      if (!o.lineItems?.edges || !Array.isArray(o.lineItems.edges) || o.lineItems.edges.length === 0) continue;
      const parentName = getOrderNumber(o.name);
      const commonField = {
        parentName, // 一级单号
        createAt: formatWestCoastDate(o.createdAt) || "/", // 订单创建时间（美西时间）
        usdToRmbRate, // 当前同步轮次汇率
        customerName: o?.shippingAddress?.name || o?.customer?.displayName || "/", // 客户姓名
        phone: o?.shippingAddress?.phone || "/", // 客户电话
        email: o?.email || "/", // 客户邮箱
        discountCode: o?.discountCode || "/", // 折扣码
        address1: o?.shippingAddress?.address1 || "/", // 详细地址
        zip: o?.shippingAddress?.zip || "/", // 邮编
        city: o?.shippingAddress?.city || "/", // 城市
        provinceCode: o?.shippingAddress?.provinceCode || "/", // 州（身份）
        countryCode: o?.shippingAddress?.countryCode || "/", // 国家
        source: targetTypeSource,
      };

      const groupedByCollection = {};

      for (const chil of o.lineItems.edges) {
        const node = chil.node || {};

        // 如果没有 product 信息，可能表示是已移除的商品，直接跳过
        if (isRemoved(node)) continue;

        // 获取当前商品的系列ID
        const productCollectionId = getProductCollectionId(node?.product?.collections?.edges);
        // const productCollectionId = (node?.product?.collections?.edges?.[0]?.node?.id || "").split("/").pop();
        // if (!COLLECTION_TYPE_IDS.includes(productCollectionId)) continue;

        if (!groupedByCollection[productCollectionId]) {
          groupedByCollection[productCollectionId] = {
            originalTotalPrice: 0,
            totalPrice: 0,
            productNames: [],
          };
        }

        const originAmount = Number(node?.originalTotalSet?.shopMoney?.amount);
        if (!Number.isNaN(originAmount)) groupedByCollection[productCollectionId].originalTotalPrice += originAmount;
        if (node?.title) groupedByCollection[productCollectionId].productNames.push(node.title);
      }

      // 新规则：先按“订单商品总价池（订单总价-运费）”按类别原总价比例分摊折后价
      const orderTotalPrice = Number(o?.totalPriceSet?.shopMoney?.amount);
      const shipFee = Number(o?.totalShippingPriceSet?.shopMoney?.amount);
      const giftCardDeductionAmount = getGiftCardDeductionAmount(o);
      const safeOrderTotalPrice = Number.isFinite(orderTotalPrice) ? orderTotalPrice : 0;
      const safeShipFee = Number.isFinite(shipFee) ? shipFee : 0;
      const goodsTotalPrice = safeOrderTotalPrice - safeShipFee - giftCardDeductionAmount;

      const groupedEntries = Object.entries(groupedByCollection);
      const orderOriginalTotalSum = groupedEntries.reduce((sum, [, item]) => {
        const original = Number(item?.originalTotalPrice);
        return Number.isFinite(original) ? sum + original : sum;
      }, 0);

      const positiveOriginalEntries = groupedEntries.filter(([, item]) => (Number(item?.originalTotalPrice) || 0) > 0);

      // 先将每个类别 totalPrice 初始化为 0，符合“原总价为0则折后价直接为0”的要求
      for (const [, item] of groupedEntries) {
        item.totalPrice = 0;
      }

      if (orderOriginalTotalSum > 0 && positiveOriginalEntries.length > 0) {
        let allocatedGoodsTotal = 0;
        const lastIdx = positiveOriginalEntries.length - 1;

        for (let i = 0; i < positiveOriginalEntries.length; i++) {
          const [, item] = positiveOriginalEntries[i];
          const original = Number(item.originalTotalPrice) || 0;

          if (i === lastIdx) {
            item.totalPrice = roundTo2(goodsTotalPrice - allocatedGoodsTotal);
          } else {
            const shared = roundTo2((goodsTotalPrice * original) / orderOriginalTotalSum);
            item.totalPrice = shared;
            allocatedGoodsTotal += shared;
          }
        }
      }

      // 分摊完成后，运费特殊加在样品类别（free swatches）上
      if (Number.isFinite(shipFee) && Object.hasOwn(groupedByCollection, FREE_SWATCHES_COLLECTION_ID)) {
        groupedByCollection[FREE_SWATCHES_COLLECTION_ID].totalPrice = roundTo2(groupedByCollection[FREE_SWATCHES_COLLECTION_ID].totalPrice + shipFee);
      }

      for (const [productCollectionId, item] of Object.entries(groupedByCollection)) {
        const productType = productCollectionId === "other" ? "其他" : COLLECTION_ID_MAP_CONFIG[productCollectionId]?.cnName;
        if (!productType) continue;
        result.push({
          ...commonField,
          originalTotalPrice: item.originalTotalPrice,
          totalPrice: item.totalPrice,
          productType,
          productNames: item.productNames?.length ? item.productNames.join("；") : "/",
        });
      }
    }

    return result;
  } catch (error) {
    return [];
  }
};

const buildRefundOrders = (orders, refundCursor, type = "refund") => {
  try {
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return [];
    }

    const { sourceKeyWord: targetTypeSource } = COLLECTION_MAP[type] || {};
    const result = [];
    const cursorTime = refundCursor ? new Date(refundCursor) : null;

    for (const order of orders) {
      const refunds = order?.refunds || [];
      if (!Array.isArray(refunds) || refunds.length === 0) continue;

      for (const refund of refunds) {
        if (!refund?.createdAt) continue;

        const refundCreatedAt = new Date(refund.createdAt);
        if (cursorTime && refundCreatedAt <= cursorTime) continue;

        const normalizedOrderName = getOrderNumber(order.name || "/");

        result.push({
          refundId: refund.id || "/",
          legacyRefundId: refund.legacyResourceId || "/",
          orderId: order.id || "/",
          orderName: normalizedOrderName,
          name: normalizedOrderName,
          productType: "退款",
          refundTime: refund.createdAt,
          refundDate: formatWestCoastDate(refund.createdAt) || "/",
          refundAmount: refund?.totalRefundedSet?.shopMoney?.amount || "0",
          refundCurrency: refund?.totalRefundedSet?.shopMoney?.currencyCode || "/",
          refundNote: refund.note || "/",
          source: targetTypeSource,
        });
      }
    }

    return result;
  } catch (error) {
    console.error(error);
    return [];
  }
};

module.exports = {
  buildThirdOrders,
  buildSecondOrders,
  buildRefundOrders,
};
