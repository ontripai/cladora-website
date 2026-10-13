/** AP10 execute callback. Transport must carry the fixture actor's established session.
 * No admin client, grants, fixture setup or writes are performed by this consumer.
 */
export function createAp10AirpropB2Consumer({ readControls, readPortfolio }) {
  return async ({ client, accessToken, contextId, workspaceIds, propertyIds, unitIds }) => {
    if (!client || !accessToken || !contextId || workspaceIds.length !== 2
      || propertyIds.length !== 2 || unitIds.length !== 3) throw new Error('airprop_b2_fixture_invalid');
    const controls = await readControls({ client, accessToken });
    if (controls.artifact_id !== 'AIRPROP-ARTIFACT-B2-20261013-R1'
      || controls.commands !== null || controls.can_edit !== false || controls.state !== 'pre_activation') {
      throw new Error('airprop_b2_controls_invalid');
    }
    let reads = 0, unavailable = 0;
    for (const workspaceId of workspaceIds) {
      const result = await readPortfolio({ client, accessToken, contextId, workspaceId });
      // Closed gates must be reported explicitly. They cannot become an empty success projection.
      if (result.status === 'denied' && result.code === 'PROVIDER_UNAVAILABLE') { unavailable += 1; continue; }
      if (result.status !== 'read' || !result.view.properties.every(item =>
        item.property.id === propertyIds[workspaceIds.indexOf(workspaceId)])) {
        throw new Error('airprop_b2_workspace_projection_invalid');
      }
      reads += 1;
    }
    return Object.freeze({ artifact: controls.artifact_id, commands: null, can_edit: false,
      workspaces: 2, properties: 2, units: 3, portfolioReads: reads, portfolioUnavailable: unavailable,
      httpAal2: 'NOT_RUN_NOT_PASS' });
  };
}
