/** Pure, fail-closed Legal coordination. Does not dispatch or store business facts. */
export const phases = Object.freeze(['scope', 'documents', 'decision', 'formalization', 'lifecycle']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export function coordinate(input) {
  const block = code => ({ result: 'BLOCKED', code, dispatch: false });
  if (!input || !phases.includes(input.phase)) return block('INVALID_PHASE');
  if (!nonempty(input.operation_id) || !nonempty(input.matter_ref) || !nonempty(input.organization_ref) || !nonempty(input.actor_ref)) return block('MISSING_REFERENCES');
  const a = input.access;
  if (!a || a.organization_ref !== input.organization_ref || a.matter_ref !== input.matter_ref || a.allowed !== true || !nonempty(a.purpose) || !Array.isArray(a.fields) || !a.fields.length || new Set(a.fields).size !== a.fields.length || a.fields.some(f => !nonempty(f) || f === '*')) return block('SCOPED_ACCESS_REQUIRED');
  const s = input.source;
  if (!s || s.organization_ref !== input.organization_ref || s.matter_ref !== input.matter_ref || !nonempty(s.map_version) || !nonempty(s.evidence_ref) || !nonempty(s.source_version) || s.fresh !== true || s.accepted !== true || s.conflict !== false) return block('SOURCE_AUTHORITY_UNRESOLVED');
  if (input.outcome === 'UNKNOWN') return { result: 'RECONCILE', code: 'RECONCILE_BEFORE_RETRY', operation_id: input.operation_id, dispatch: false };
  if (input.outcome !== 'KNOWN' || input.authority?.revoked !== false || input.authority?.takeover !== false) return block('CURRENT_AUTHORITY_REQUIRED');
  const g = input.authority;
  if (g?.permitted !== true || !nonempty(g.grant_ref)) return block('AUTHORITY_REQUIRED');
  if (g.actor_ref !== input.actor_ref || g.organization_ref !== input.organization_ref || g.matter_ref !== input.matter_ref || g.operation_id !== input.operation_id || g.phase !== input.phase || g.document_version !== (input.document?.version ?? null)) return block('GRANT_SCOPE_MISMATCH');
  if (![input.evaluated_at, g.valid_from, g.valid_until].every(Number.isSafeInteger) || g.valid_from > input.evaluated_at || input.evaluated_at >= g.valid_until || g.valid_until <= g.valid_from) return block('GRANT_WINDOW_INVALID');
  if (input.external_contact === true) return { result: 'CONTRIBUTION_REQUIRED', receiver: 'customer-service', operation_id: input.operation_id, dispatch: false };
  if (input.external_contact !== false) return block('CONTACT_CLASSIFICATION_REQUIRED');
  if (input.phase === 'scope' && input.applicability !== 'ACCEPTED') return block('APPLICABILITY_REQUIRES_COMPETENT_SOURCE');
  if (input.phase === 'documents' && (!nonempty(input.document?.version) || !nonempty(input.document?.template_ref) || !nonempty(input.document?.input_ref) || input.document?.template_accepted !== true)) return block('ACCEPTED_TEMPLATE_AND_INPUTS_REQUIRED');
  if (input.phase === 'decision' || input.phase === 'formalization') {
    const d = input.decision;
    if (!nonempty(input.document?.version) || !nonempty(d?.actor_ref) || !nonempty(d?.power_ref) || d?.organization_ref !== input.organization_ref || d?.matter_ref !== input.matter_ref || d?.operation_id !== input.operation_id || d?.competent !== true || d?.accepted !== true || d?.document_version !== input.document.version || d?.material_change !== false || d?.revoked !== false) return block('EXACT_COMPETENT_DECISION_REQUIRED');
    if (d.independent_review_required !== false && d.independent_review_required !== true) return block('REVIEW_POLICY_REQUIRED');
    if (d.independent_review_required && (!nonempty(d.reviewer_ref) || d.reviewer_ref === d.actor_ref || d.reviewer_competent !== true)) return block('DISTINCT_COMPETENT_REVIEWER_REQUIRED');
  }
  if (input.phase === 'formalization') {
    if (!nonempty(input.document?.checksum) || typeof input.professional_required !== 'boolean') return block('FORMALIZATION_POLICY_REQUIRED');
    if (input.professional_required && (!nonempty(input.professional?.result_ref) || input.professional?.attributable !== true)) return block('ATTRIBUTABLE_RESULT_REQUIRED');
  }
  if (input.phase === 'lifecycle') {
    const r = input.retention;
    if (!nonempty(r?.policy_ref) || !nonempty(r?.decision_ref) || r?.accepted !== true || r?.derivatives_covered !== true || typeof r.hold !== 'boolean' || typeof r.disposal_requested !== 'boolean') return block('RETENTION_CONTRACT_REQUIRED');
    if (r.disposal_requested && (r.hold || r.disposal_authorized !== true)) return block('HOLD_OR_DISPOSAL_AUTHORITY');
  }
  return { result: 'COORDINATION_READY', phase: input.phase, operation_id: input.operation_id, matter_ref: input.matter_ref, dispatch: false, business_completion: false, legal_validity_claimed: false };
}
