export interface SaucedemoProduct {
  product_id: string;
  product_name: string;
  description: string;
  price: string;
  quantity: number;
  customer: string;
  order_ref: string;
  delivery_date: string;
  category: string;
}

export const saucedemoProducts: Record<string, SaucedemoProduct> = {
  "SLD-BAK-001": {
    product_id: "SLD-BAK-001",
    product_name: "Sauce Labs Backpack",
    description: "carry.allTheThings() with the sleek Sly Pack that melds uncompromising style",
    price: "29.99",
    quantity: 120,
    customer: "Walmart Supercenter Norte",
    order_ref: "SLD-BAK-001",
    delivery_date: "2026-06-20",
    category: "Accesorios",
  },
  "SLD-BLT-002": {
    product_id: "SLD-BLT-002",
    product_name: "Sauce Labs Bike Light",
    description: "A red light isn't the desired state in testing but it sure looks good on a bike",
    price: "9.99",
    quantity: 200,
    customer: "OXXO Distribución Norte",
    order_ref: "SLD-BLT-002",
    delivery_date: "2026-06-25",
    category: "Accesorios",
  },
  "SLD-TSH-003": {
    product_id: "SLD-TSH-003",
    product_name: "Sauce Labs Bolt T-Shirt",
    description: "Get your testing superhero on with the Sauce Labs bolt T-shirt",
    price: "15.99",
    quantity: 75,
    customer: "Sam's Club Garza García",
    order_ref: "SLD-TSH-003",
    delivery_date: "2026-06-30",
    category: "Ropa",
  },
  "SLD-FLC-004": {
    product_id: "SLD-FLC-004",
    product_name: "Sauce Labs Fleece Jacket",
    description: "It's not every day you come across a midweight quarter-zip fleece jacket",
    price: "49.99",
    quantity: 45,
    customer: "HEB Premium Monterrey",
    order_ref: "SLD-FLC-004",
    delivery_date: "2026-07-05",
    category: "Ropa",
  },
  "SLD-ONE-005": {
    product_id: "SLD-ONE-005",
    product_name: "Sauce Labs Onesie",
    description: "Rib snap infant onesie for the junior automation engineer in development",
    price: "7.99",
    quantity: 300,
    customer: "Soriana Supermercado Vallejo",
    order_ref: "SLD-ONE-005",
    delivery_date: "2026-07-10",
    category: "Ropa Infantil",
  },
};