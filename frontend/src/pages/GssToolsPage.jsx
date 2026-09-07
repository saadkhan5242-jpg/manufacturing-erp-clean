import ShopTraveler from "../components/ShopTraveler";
import BomTreeExplorer from "../components/BomTreeExplorer";
import OrderEntryForm from "../components/OrderEntryForm";

/**
 * GssToolsPage — hosts the three GSS transactional sub-modules.
 * view: "traveler" | "bom" | "order"
 */
function GssToolsPage({ view }) {
  if (view === "traveler") {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <ShopTraveler />
      </div>
    );
  }
  if (view === "bom") {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <BomTreeExplorer rootPart="BRACKET-ASSY" />
      </div>
    );
  }
  if (view === "order") {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <OrderEntryForm />
      </div>
    );
  }
  return (
    <div className="p-6 max-w-7xl mx-auto grid gap-8 md:grid-cols-2">
      <OrderEntryForm />
      <BomTreeExplorer rootPart="BRACKET-ASSY" />
      <div className="md:col-span-2"><ShopTraveler /></div>
    </div>
  );
}

export default GssToolsPage;
