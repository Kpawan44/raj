import { JobCard, MaterialMovement } from '../types';

export function getJobCardProcessMetrics(j: JobCard, movementsList: MaterialMovement[]) {
  // Filter movements for this job card
  const cardMovements = movementsList.filter(m => m.jobCardNo === j.jobCardNo);
  const acceptedMovements = cardMovements.filter(m => m.accepted);

  // --- PRODUCTION / HEAT TREATMENT ---> PLATING
  // Received from production (actual weight produced)
  const prodMovements = cardMovements.filter(m => m.fromDepartment === 'Production');
  let qtyReceivedFromProd = prodMovements.reduce((sum, m) => sum + m.quantity, 0);
  if (qtyReceivedFromProd === 0 && j.currentDepartment !== 'Production') {
    qtyReceivedFromProd = j.currentQty;
  }
  
  // Routed to plating (how much we will send / have sent for plating)
  let qtyRoutedToPlating = j.customRoutedToPlating !== undefined && j.customRoutedToPlating !== null
    ? j.customRoutedToPlating
    : cardMovements
        .filter(m => m.toDepartment === 'Plating')
        .reduce((sum, m) => sum + m.quantity, 0);

  const htRejections = j.heatTreatmentDetails?.rejectionQty || 0;

  if (j.customRoutedToPlating === undefined || j.customRoutedToPlating === null) {
    if (qtyRoutedToPlating === 0) {
      if (j.currentDepartment === 'Heat Treatment') {
        // If in Heat Treatment, we will send to plating: ReceivedFromProd - HT rejections
        qtyRoutedToPlating = Math.max(0, qtyReceivedFromProd - htRejections);
      } else if (j.currentDepartment !== 'Production') {
        // If past production and straightforward, same as received from prod
        qtyRoutedToPlating = Math.max(0, qtyReceivedFromProd - htRejections);
      }
    }
  }

  // Remaining at Prod = Received - RoutedToPlating - HT_rejections
  const qtyRemainingAtProd = Math.max(0, qtyReceivedFromProd - qtyRoutedToPlating - htRejections);


  // --- PLATING ---> PACKING
  // Received at plating
  let qtyReceivedAtPlating = acceptedMovements
    .filter(m => m.toDepartment === 'Plating')
    .reduce((sum, m) => sum + m.quantity, 0);
  
  // If no movements but the card is in Plating or past Plating, we fallback to actual received from production minus HT rejections
  if (qtyReceivedAtPlating === 0 && (j.currentDepartment !== 'Production' && j.currentDepartment !== 'Heat Treatment')) {
    qtyReceivedAtPlating = Math.max(0, qtyReceivedFromProd - htRejections);
  }

  const qtyRoutedToPacking = acceptedMovements
    .filter(m => m.toDepartment === 'Packing')
    .reduce((sum, m) => sum + m.quantity, 0);

  const platingRejections = j.platingDetails?.rejectionQty || 0;
  const qtyRemainingAtPlating = Math.max(0, qtyReceivedAtPlating - qtyRoutedToPacking - platingRejections);


  // --- PACKING ---> STORE
  let qtyReceivedAtPacking = acceptedMovements
    .filter(m => m.toDepartment === 'Packing')
    .reduce((sum, m) => sum + m.quantity, 0);

  if (qtyReceivedAtPacking === 0 && (j.currentDepartment === 'Packing' || j.currentDepartment === 'Store' || j.currentDepartment === 'Completed')) {
    qtyReceivedAtPacking = Math.max(0, qtyReceivedAtPlating - platingRejections);
  }

  const qtyRoutedToStore = acceptedMovements
    .filter(m => m.toDepartment === 'Store')
    .reduce((sum, m) => sum + m.quantity, 0);

  const packingRejections = j.packingDetails?.rejectionQty || 0;
  const qtyRemainingAtPacking = Math.max(0, qtyReceivedAtPacking - qtyRoutedToStore - packingRejections);


  // --- STORE / WAREHOUSE ---> DISPATCH
  let qtyReceivedAtStore = acceptedMovements
    .filter(m => m.toDepartment === 'Store')
    .reduce((sum, m) => sum + m.quantity, 0);

  if (qtyReceivedAtStore === 0 && (j.currentDepartment === 'Store' || j.currentDepartment === 'Completed')) {
    qtyReceivedAtStore = j.packingDetails?.packedQty || Math.max(0, qtyReceivedAtPacking - packingRejections);
  }

  // How much dispatch (shipped out)
  const qtyDispatched = j.dispatchDetails?.dispatchQty || (j.completed ? j.currentQty : 0);

  // How much remain in stock
  const qtyRemainingInStock = Math.max(0, qtyReceivedAtStore - qtyDispatched);

  return {
    // Prod/HT
    qtyReceivedFromProd,
    qtyRoutedToPlating,
    qtyRemainingAtProd,
    htRejections,

    // Plating
    qtyReceivedAtPlating,
    qtyRoutedToPacking,
    qtyRemainingAtPlating,
    platingRejections,

    // Packing
    qtyReceivedAtPacking,
    qtyRoutedToStore,
    qtyRemainingAtPacking,
    packingRejections,

    // Store
    qtyReceivedAtStore,
    qtyDispatched,
    qtyRemainingInStock
  };
}
