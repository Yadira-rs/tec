export interface SorianaOrder {
  PurchaseOrder: string;
  CustomerName: string;
  DeliveryDate: string;
  SKUDescription: string;
  UnitPrice: string;
  RequestedQty: string;
  OrderDetail: string;
}

export const sorianaOrders: Record<string, SorianaOrder> = {
  "OC-SOR-2024-001": {
    PurchaseOrder: "OC-SOR-2024-001",
    CustomerName: "Soriana Cumbres",
    DeliveryDate: "2026-06-15",
    SKUDescription: "Coca-Cola 600ml",
    UnitPrice: "14.50",
    RequestedQty: "200",
    OrderDetail: "Entrega en CEDIS Monterrey Norte",
  },
  "OC-SOR-2024-002": {
    PurchaseOrder: "OC-SOR-2024-002",
    CustomerName: "Soriana Satélite",
    DeliveryDate: "2026-06-20",
    SKUDescription: "Coca-Cola 355ml",
    UnitPrice: "11.00",
    RequestedQty: "150",
    OrderDetail: "Entrega en CEDIS Sur",
  },
  "OC-SOR-2024-003": {
    PurchaseOrder: "OC-SOR-2024-003",
    CustomerName: "Soriana Vallejo",
    DeliveryDate: "2026-06-25",
    SKUDescription: "Coca-Cola 2L",
    UnitPrice: "28.00",
    RequestedQty: "100",
    OrderDetail: "Entrega en CEDIS Vallejo CDMX",
  },
  "OC-SOR-2024-004": {
    PurchaseOrder: "OC-SOR-2024-004",
    CustomerName: "Soriana Tlalnepantla",
    DeliveryDate: "2026-06-28",
    SKUDescription: "Fanta Naranja 600ml",
    UnitPrice: "12.50",
    RequestedQty: "300",
    OrderDetail: "Entrega en CEDIS Tlalnepantla",
  },
  "OC-SOR-2024-005": {
    PurchaseOrder: "OC-SOR-2024-005",
    CustomerName: "Soriana Monterrey Centro",
    DeliveryDate: "2026-07-02",
    SKUDescription: "Sprite 600ml",
    UnitPrice: "13.00",
    RequestedQty: "250",
    OrderDetail: "Entrega en CEDIS Monterrey Centro",
  },
};