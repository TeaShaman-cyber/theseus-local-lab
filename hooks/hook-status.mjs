function exitedSuccessfully(result) {
  return result?.status === 0;
}

function providerFlushSucceeded(result, payload) {
  return exitedSuccessfully(result) && payload?.pending === 0;
}

export function stopHookOk({
  memoryGateResult,
  memoryOutboxResult,
  memoryFlushResult,
  mempalaceFlushResult,
  memoryFlushPayload,
  mempalaceFlushPayload,
  hindsightResult,
  usageResult,
  pressureResult,
  skillObservatoryResult,
  checkpointResult,
}) {
  const requiredResults = [
    memoryGateResult,
    memoryOutboxResult,
    hindsightResult,
    usageResult,
    pressureResult,
  ];
  const observatoryOk = skillObservatoryResult?.status === 0 || skillObservatoryResult?.status === 2;
  const checkpointOk = !checkpointResult || exitedSuccessfully(checkpointResult);
  return requiredResults.every(exitedSuccessfully)
    && providerFlushSucceeded(memoryFlushResult, memoryFlushPayload)
    && providerFlushSucceeded(mempalaceFlushResult, mempalaceFlushPayload)
    && observatoryOk
    && checkpointOk;
}
