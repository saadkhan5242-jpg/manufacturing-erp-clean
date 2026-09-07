import { 
  ClipboardList, Clock, Layers, ShieldCheck, Cpu, 
  Warehouse, BarChart3, TrendingUp, Settings, Sparkles
} from "lucide-react";

// 1. Array mapping the top horizontal colored navigation bar row buttons
// token = the activeModule state key the Dashboard workspace switches on
export const commandModules = [
  { label: "Widgets", token: "WIDGETS", to: "/modules/widgets", icon: Layers, tone: "orange" },
  { label: "Admin &\nControl", token: "ADMIN", to: "/modules/admin-control", icon: ShieldCheck, tone: "red" },
  { label: "Production", token: "PRODUCTION", to: "/modules/production", icon: Cpu, tone: "blue" },
  { label: "Inventory", token: "INVENTORY", to: "/modules/inventory", icon: Warehouse, tone: "cyan" },
  { label: "Customers &\nProspects", token: "CUSTOMERS", to: "/modules/customers", icon: BarChart3, tone: "green" },
  { label: "Vendors", token: "VENDORS", to: "/modules/vendors", icon: TrendingUp, tone: "light-green" },
  { label: "Accounting", token: "ACCOUNTING", to: "/modules/accounting", icon: ClipboardList, tone: "yellow" },
  { label: "AI Tools", token: "AI_TOOLS", to: "/modules/ai-tools", icon: Sparkles, tone: "magenta" },
  { label: "BOM Setup", token: "BOM_SETUP", to: "/modules/bom-manager", icon: Settings, tone: "blue" },
  { label: "Shop Floor", token: "SHOP_FLOOR", to: "/modules/shop-floor", icon: Clock, tone: "green" }
];

// TRACK 1: top-toolbar state-machine tokens. Maps each toolbar tab's URL key to
// the active display token consumed by the central workspace wrapper.
export const MODULE_TOKENS = {
  "widgets": "WIDGETS",
  "admin-control": "ADMIN",
  "production": "PRODUCTION",
  "inventory": "INVENTORY",
  "customers": "CUSTOMERS",
  "vendors": "VENDORS",
  "accounting": "ACCOUNTING",
  "ai-tools": "AI_TOOLS",
  "bom-manager": "BOM_SETUP",
  "shop-floor": "SHOP_FLOOR"
};

// 2. Comprehensive mapping catalog defining every single layout grid card visible on your screen
export const moduleCatalog = {
  widgets: { title: "Widgets", tone: "orange", groups: [{ title: "DASHBOARD", items: [] }] },
  "admin-control": { title: "Admin & Control", tone: "red", groups: [{ title: "SETTINGS", items: [] }] },
  
  production: {
    title: "Production",
    tone: "blue",
    groups: [
      {
        title: "EXECUTION",
        items: [
          { label: "Work orders", path: "/work-orders", icon: ClipboardList },
          { label: "Live Job Dashboard", path: "/modules/live-jobs", icon: BarChart3 },
          { label: "Live Operations (BI)", path: "/modules/live-operations", icon: TrendingUp },
          { label: "Job clock", path: "/job-clock", icon: Clock },
          { label: "MRP Run Engine", path: "/modules/mrp-plans", icon: Cpu },
          { label: "Scheduling", path: "/scheduling", icon: Layers },
          { label: "Finite schedule", path: "/finite-schedule", icon: ShieldCheck }
        ]
      },
      {
        title: "ENGINEERING",
        items: [
          { label: "Routings", path: "/routings", icon: Cpu },
          { label: "BOM Router Setup", path: "/modules/bom-manager", icon: Settings },
          { label: "BOM Tree Explorer", path: "/modules/bom-explorer", icon: Layers },
          { label: "Shop Floor Terminal", path: "/modules/shop-floor", icon: Clock },
          { label: "Shop Traveler", path: "/modules/shop-traveler", icon: ClipboardList },
          { label: "BOMs of material", path: "/parts", icon: Warehouse },
          { label: "Work centers", path: "/work-centers", icon: Settings }
        ]
      }
    ]
  },

  inventory: {
    title: "Inventory",
    tone: "cyan",
    groups: [
      {
        title: "MASTER DATA",
        items: [
          { label: "Parts catalog", path: "/parts", icon: ClipboardList },
          { label: "Products", path: "/products", icon: Warehouse },
          { label: "Inventory levels", path: "/modules/inventory", icon: Layers }
        ]
      },
      {
        title: "TRACEABILITY",
        items: [
          { label: "Move tickets", path: "/work-orders", icon: Cpu },
          { label: "Lot & Serial tracking", path: "/job-clock", icon: ShieldCheck },
          { label: "Quality inspections", path: "/scheduling", icon: ShieldCheck }
        ]
      }
    ]
  },

  purchasing: {
    title: "Purchasing",
    tone: "green",
    groups: [
      {
        title: "TRANSACTIONS",
        items: [
          { label: "Purchase orders", path: "/purchase-orders", icon: ClipboardList },
          { label: "Document center", path: "/modules/documents", icon: ClipboardList },
          { label: "Sales orders", path: "/work-orders", icon: ClipboardList }
        ]
      },
      {
        title: "PLANNING",
        items: [
          { label: "Suppliers", path: "/suppliers", icon: ClipboardList },
          { label: "RFQs", path: "/scheduling", icon: Layers },
          { label: "Material coverage", path: "/scheduling", icon: ShieldCheck }
        ]
      }
    ]
  },

  customers: { title: "Customers & Prospects", tone: "green", groups: [{ title: "CRM DATA", items: [{ label: "Daily Shipments", path: "/modules/shipments", icon: ClipboardList }, { label: "Order Entry", path: "/modules/order-entry", icon: TrendingUp }] }] },
  vendors: { title: "Vendors", tone: "light-green", groups: [{ title: "SUPPLIER PORTAL", items: [] }] },
  accounting: { title: "Accounting", tone: "yellow", groups: [{ title: "LEDGER", items: [] }] },
  "ai-tools": { title: "AI Tools", tone: "magenta", groups: [{ title: "WORKSPACE", items: [{ label: "AI workspace", path: "/ai", icon: Sparkles }] }] }
};

// 3. Array mapping loop conversion required explicitly by Dashboard.jsx 
export const workspacePanels = Object.keys(moduleCatalog).map((key) => ({
  id: key,
  title: moduleCatalog[key].title,
  tone: moduleCatalog[key].tone,
  groups: moduleCatalog[key].groups || []
}));
