const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// ==========================================
// 配置区域
// ==========================================
// 在此处替换为您要查询的订单 ID
// const ORDER_ID = "gid://shopify/Order/6778719469886"; // 3726
// const ORDER_ID = "gid://shopify/Order/6792919646526"; // 3851
const ORDER_ID = "gid://shopify/Order/6443830116670";

const { SHOPIFY_STORE_URL, SHOPIFY_ADMIN_API_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env;

// ==========================================
// GraphQL 查询构建
// ==========================================
// 字段说明备注：
// 1. id: 订单ID
// 2. name: 订单名称 (例如 #1001)
// 3. totalPriceSet: 订单价格 (包含币种和金额)
// 4. lineItems: 订单商品列表
//    - quantity: 数量
//    - product.productType: 产品类型
//    - customAttributes: 自定义属性 (通常包含 宽度、高度、headerStyle、liner、ringColor、tieBack、memoryShape、room、花边型号 等定制信息)
//    - variant.selectedOptions: 变体选项 (也可能包含部分规格信息)
//    - sku: SKU
const QUERY = `
query($id: ID!) {
  order(id: $id) {
    # 订单ID
    id
    # 订单名称
    name
    # 创建时间
    createdAt
    # 支付状态 (例如: PAID, PENDING, REFUNDED)
    displayFinancialStatus
    # 发货状态 (例如: FULFILLED, UNFULFILLED)
    displayFulfillmentStatus
    # 取消时间 (如果不为空，则表示已取消)
    cancelledAt
    # 取消原因
    cancelReason
    # 关闭时间 (如果不为空，则表示已归档/关闭)
    closedAt
    discountCode
    note
    email
    customer {
      # 客户姓名 (显示名)
      displayName
      # 客户 firstName
      firstName
      # 客户 lastName
      lastName
      # 客户手机号
      phone
    }
    # 订单价格
    totalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    # 总运费价格
    totalShippingPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    discountApplications(first: 20) {
      edges {
        node {
          index
          __typename
          ... on DiscountCodeApplication {
            code
          }
          value {
            __typename
            ... on PricingPercentageValue {
              percentage
            }
            ... on MoneyV2 {
              amount
              currencyCode
            }
          }
          ... on AutomaticDiscountApplication {
            title
          }
          ... on ManualDiscountApplication {
            title
          }
        }
      }
    }
    shippingAddress {
      name
      phone
      address1
      address2
      city
      province
      provinceCode
      zip
      country
      countryCode
    }
    # 订单商品行 (取前50条)
    lineItems(first: 50) {
      edges {
        node {
          # 商品ID
          id
          # 商品名称
          title
          # 数量
          quantity
          # 当前数量
          currentQuantity
          # SKU
          sku
          # 行级原总价（已乘以数量）
          originalTotalSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          # 行级折扣后总价（已乘以数量）
          discountedTotalSet(withCodeDiscounts: true) {
            # 店铺默认币种 USD
            shopMoney {
              amount
              currencyCode
            }
            # 支付币种
            presentmentMoney {
              amount
              currencyCode
            }
          }
          # 变体标题 (快照，通常包含规格简写，如 "L / Red")
          variantTitle
          
          # 注意：以下字段 (product, variant) 需要 read_products 权限。
          # 如果您的 Access Token 只有 read_orders 权限，请求会报错。
          # 为了保证脚本能运行，我暂时注释掉了这部分。如果您有权限，可以取消注释。
          
          # 产品信息 (需 read_products 权限)
          product {
            # productType
            title
            # 产品类别
            # category {
            #   name
            #   isLeaf
            #   level
            #   parentId
            # }
            # 产品系列 (Collection) - 匹配指定ID
            collections(first: 50) {
              edges {
                node {
                  id
                }
              }
            }
          }
          
          # 变体详情 (需 read_products 权限)
          variant {
            title
            selectedOptions {
              name
              value
            }
          }
          
          # 自定义属性 (关键字段：宽度、高度、room、花边型号等通常存储于此)
          customAttributes {
            key
            value
          }
          discountAllocations {
            allocatedAmount {
              amount
              currencyCode
            }
            discountApplication {
              index
              __typename
              ... on DiscountCodeApplication {
                code
                value {
                  __typename
                  ... on MoneyV2 {
                    amount
                    currencyCode
                  }
                  ... on PricingPercentageValue {
                    percentage
                  }
                }
              }
              ... on AutomaticDiscountApplication {
                title
                value {
                  __typename
                  ... on MoneyV2 {
                    amount
                    currencyCode
                  }
                  ... on PricingPercentageValue {
                    percentage
                  }
                }
              }
              ... on ManualDiscountApplication {
                title
                value {
                  __typename
                  ... on MoneyV2 {
                    amount
                    currencyCode
                  }
                  ... on PricingPercentageValue {
                    percentage
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

// ==========================================
// 主逻辑
// ==========================================
async function fetchSingleOrder() {
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
    console.error("❌ 错误: 缺少环境变量配置 (.env)");
    process.exit(1);
  }

  const shopUrl = SHOPIFY_STORE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiUrl = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION || "2024-01"}/graphql.json`;

  console.log(`🔍 正在查询订单: ${ORDER_ID}`);
  console.log(`🌐 API URL: ${apiUrl}`);

  try {
    const response = await axios.post(
      apiUrl,
      {
        query: QUERY,
        variables: {
          id: ORDER_ID,
        },
      },
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("❌ GraphQL 查询错误:", JSON.stringify(response.data.errors, null, 2));
      return;
    }

    const orderData = response.data.data.order;

    if (!orderData) {
      console.error("❌ 未找到订单，请检查 ID 是否正确。");
      return;
    }

    // 格式化输出文件名
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFile = path.join(outputDir, "single_order_result.json");

    // 写入文件 (完全覆盖)
    // 后处理：过滤仅保留智能产品系列 (Smart Collection)
    // if (orderData.lineItems && orderData.lineItems.edges) {
    //   orderData.lineItems.edges.forEach(edge => {
    //     const product = edge.node.product;
    //     if (product && product.collections && product.collections.edges) {
    //       // 过滤逻辑：只保留有 ruleSet 的系列 (即智能产品系列)
    //       // 如果您想要按照名称过滤 (例如标题为 "智能产品系列")，请修改为: c.node.title === "智能产品系列"
    //       product.collections.edges = product.collections.edges.filter(c => c.node.ruleSet !== null && c.node.ruleSet !== undefined);
    //     }
    //   });
    // }
    console.log("\n--- 订单备注note---", orderData?.note || "没得");
    
    fs.writeFileSync(outputFile, JSON.stringify(orderData, null, 2), "utf8");

    console.log("✅ 查询成功！");
    console.log(`📂 结果已保存至: ${outputFile}`);

    // --- 状态判断示例 ---
    console.log("\n--- 订单状态判断示例 ---");
    const isCancelled = orderData.cancelledAt !== null;
    if (isCancelled) {
      console.log(`⚠️ 订单已取消`);
      console.log(`   取消时间: ${orderData.cancelledAt}`);
      console.log(`   取消原因: ${orderData.cancelReason}`);
    } else {
      console.log(`✅ 订单状态正常 (未取消)`);
    }

    console.log(`💰 支付状态: ${orderData.displayFinancialStatus}`);
    console.log(`📦 发货状态: ${orderData.displayFulfillmentStatus}`);
    // -------------------

    // 简单打印部分关键信息供预览
    // console.log("\n--- 订单摘要 ---");
    // console.log(`ID: ${orderData.id}`);
    // console.log(`名称: ${orderData.name}`);
    // console.log(`价格: ${orderData.totalPriceSet?.shopMoney?.amount} ${orderData.totalPriceSet?.shopMoney?.currencyCode}`);
    // console.log(`商品行数: ${orderData.lineItems.edges.length}`);

    // if (orderData.lineItems.edges.length > 0) {
    //   const firstItem = orderData.lineItems.edges[0].node;
    //   console.log("\n--- 第一条商品示例 ---");
    //   console.log(`商品: ${firstItem.title}`);
    //   console.log(`自定义属性 (Custom Attributes):`);
    //   console.table(firstItem.customAttributes);
    // }
  } catch (error) {
    console.error("❌ 请求失败:", error.message);
    if (error.response) {
      console.error("响应详情:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

fetchSingleOrder();
