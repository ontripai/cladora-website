export const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export function mapGovernanceRpcError(error: { code?: string; message?: string }): {
  status: number;
  body: { error: { code: string; message: string } };
} {
  const code = error?.code || "";
  const msg = error?.message || "";

  // Authentication errors
  if (
    (code === "42501" || code === "401") &&
    (msg.includes("authentication_required") || msg.includes("UNAUTHORIZED"))
  ) {
    return {
      status: 401,
      body: { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
    };
  }

  // Authorization & MFA errors
  if (
    code === "42501" ||
    msg.includes("permission_denied") ||
    msg.includes("access_denied") ||
    msg.includes("mfa_elevation_required") ||
    msg.includes("governance_permission_required") ||
    msg.includes("voter_not_eligible_on_record_date") ||
    msg.includes("customer_context_access_denied")
  ) {
    const isMfa = msg.includes("mfa_elevation_required") || msg.includes("mfa_required");
    const isNotEligible = msg.includes("voter_not_eligible_on_record_date");
    return {
      status: 403,
      body: {
        error: {
          code: isMfa ? "MFA_REQUIRED" : isNotEligible ? "VOTER_NOT_ELIGIBLE" : "FORBIDDEN",
          message: isMfa
            ? "MFA elevation required for this governance action."
            : isNotEligible
            ? "Member is not eligible to vote on the record date."
            : "Action forbidden or requires governance elevation.",
        },
      },
    };
  }

  // Fail-closed unconfigured governance policy
  if (msg.includes("governance_policy_unconfigured") || msg.includes("active_policy_not_found")) {
    return {
      status: 422,
      body: {
        error: {
          code: "GOVERNANCE_POLICY_UNCONFIGURED",
          message: "No active governance policy configured for association. Cannot evaluate statutory rules.",
        },
      },
    };
  }

  // Lifecycle & Conflict errors
  if (
    msg.includes("statutory_quorum_not_reached") ||
    msg.includes("vote_already_cast_for_ballot") ||
    msg.includes("ballot_is_not_open_for_voting") ||
    msg.includes("ballot_already_closed") ||
    msg.includes("meeting_not_in_draft_state") ||
    msg.includes("meeting_must_be_draft_to_add_agenda") ||
    msg.includes("meeting_must_be_published_to_open") ||
    msg.includes("meeting_must_be_in_progress_to_complete") ||
    msg.includes("meeting_must_be_in_progress_to_open_ballot") ||
    msg.includes("meeting_must_be_in_progress_or_completed_to_finalize_minutes") ||
    msg.includes("minutes_already_finalized") ||
    msg.includes("prior_minutes_version_mismatch") ||
    msg.includes("resolution_code_already_exists_for_meeting") ||
    msg.includes("action_identifier_already_exists_for_resolution")
  ) {
    let errorCode = "GOVERNANCE_CONFLICT";
    if (msg.includes("statutory_quorum_not_reached")) errorCode = "QUORUM_NOT_REACHED";
    else if (msg.includes("vote_already_cast_for_ballot")) errorCode = "VOTE_ALREADY_CAST";
    else if (msg.includes("ballot_is_not_open_for_voting")) errorCode = "BALLOT_NOT_OPEN";
    else if (msg.includes("minutes_already_finalized")) errorCode = "MINUTES_ALREADY_FINALIZED";
    else if (msg.includes("prior_minutes_version_mismatch")) errorCode = "MINUTES_VERSION_MISMATCH";

    return {
      status: 409,
      body: { error: { code: errorCode, message: msg || "Governance lifecycle conflict." } },
    };
  }

  // Statutory Validation errors
  if (
    msg.includes("insufficient_notice_period") ||
    msg.includes("reconvened_notice_out_of_statutory_window") ||
    msg.includes("reconvened_interval_out_of_statutory_window") ||
    msg.includes("proxy_representative_limit_exceeded") ||
    msg.includes("proxy_cycle_or_self_representation_not_permitted") ||
    msg.includes("parent_meeting_must_be_adjourned_no_quorum") ||
    msg.includes("invalid_voting_rule") ||
    msg.includes("invalid_governance_policy") ||
    msg.includes("required") ||
    msg.includes("invalid") ||
    code === "22004" ||
    code === "22023" ||
    code === "23505" ||
    code === "23503"
  ) {
    let errCode = "INVALID_REQUEST";
    if (msg.includes("insufficient_notice_period")) errCode = "INSUFFICIENT_NOTICE_PERIOD";
    else if (msg.includes("reconvened_notice_out_of_statutory_window") || msg.includes("reconvened_interval_out_of_statutory_window")) errCode = "RECONVENED_NOTICE_INVALID";
    else if (msg.includes("proxy_representative_limit_exceeded")) errCode = "PROXY_LIMIT_EXCEEDED";
    else if (msg.includes("proxy_cycle_or_self_representation_not_permitted")) errCode = "INVALID_PROXY_REPRESENTATION";

    return {
      status: 400,
      body: { error: { code: errCode, message: msg || "Invalid governance request parameters." } },
    };
  }

  // Not Found errors
  if (code === "P0002" || msg.includes("not_found")) {
    return {
      status: 404,
      body: { error: { code: "NOT_FOUND", message: "Requested governance entity not found." } },
    };
  }

  // Fallback internal error
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Internal governance service error." } },
  };
}
