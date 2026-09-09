export const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export interface AssetsApiErrorResponse {
  status: number;
  body: {
    error: {
      code: string;
      message: string;
    };
  };
}

export function mapAssetsRpcError(err: any): AssetsApiErrorResponse {
  if (!err) {
    return {
      status: 500,
      body: { error: { code: "INTERNAL_SERVER_ERROR", message: "Unknown error occurred" } },
    };
  }

  const msg = (err.message || err.details || "").toLowerCase();
  const code = (err.code || "").toUpperCase();

  // 1. Authentication & Permission Errors (42501)
  if (
    code === "42501" ||
    msg.includes("mfa_required") ||
    msg.includes("authentication_required") ||
    msg.includes("access_denied") ||
    msg.includes("insufficient_permissions") ||
    msg.includes("dual_control_required_for_critical_asset")
  ) {
    if (msg.includes("mfa_required")) {
      return {
        status: 403,
        body: { error: { code: "MFA_REQUIRED", message: "Elevated AAL2 authentication required for safety-critical operations." } },
      };
    }
    if (msg.includes("dual_control_required_for_critical_asset")) {
      return {
        status: 403,
        body: { error: { code: "DUAL_CONTROL_VIOLATION", message: "Dual-control required: Decommission approver cannot be the requester for critical assets." } },
      };
    }
    return {
      status: 403,
      body: { error: { code: "FORBIDDEN", message: "Access denied. Insufficient permissions for this asset operation." } },
    };
  }

  // 2. Exclusion Constraint Violations (Overlaps)
  if (code === "23P01" || msg.includes("exclusion_violation") || msg.includes("asset_downtimes_no_overlap") || msg.includes("compliance_policies_no_overlap")) {
    return {
      status: 409,
      body: {
        error: {
          code: "INTERVAL_OVERLAP_CONFLICT",
          message: "Temporal conflict: Overlapping downtime period or compliance policy effective interval detected.",
        },
      },
    };
  }

  // 3. Direct Decommission Lifecycle Bypass
  if (msg.includes("direct_decommission_forbidden")) {
    return {
      status: 400,
      body: {
        error: {
          code: "DIRECT_DECOMMISSION_FORBIDDEN",
          message: "Direct decommissioning is prohibited. Submit a decommission request for independent dual-control approval.",
        },
      },
    };
  }

  // 4. Compliance Policy Missing / Unconfigured
  if (msg.includes("compliance_policy_unconfigured")) {
    return {
      status: 422,
      body: {
        error: {
          code: "COMPLIANCE_POLICY_UNCONFIGURED",
          message: "No active statutory compliance policy configured for this asset category and jurisdiction.",
        },
      },
    };
  }

  // 5. Hard Delete Prevention
  if (msg.includes("asset_hard_delete_prohibited") || msg.includes("physical deletion is strictly forbidden")) {
    return {
      status: 405,
      body: {
        error: {
          code: "DELETE_PROHIBITED",
          message: "Hard deletion of building equipment or asset history is strictly prohibited by domain contract.",
        },
      },
    };
  }

  // 6. Immutability
  if (
    msg.includes("decommissioned_asset_is_immutable") ||
    msg.includes("retired_asset_is_immutable") ||
    msg.includes("verified_inspection_is_immutable") ||
    msg.includes("resolved_claim_is_immutable")
  ) {
    return {
      status: 409,
      body: {
        error: {
          code: "IMMUTABLE_RECORD",
          message: "This record has been finalized and certified, making it strictly immutable.",
        },
      },
    };
  }

  // 7. Invalid Evidence / Malware Scan Pending / Deferred
  if (msg.includes("document_not_authoritative_evidence") || msg.includes("unscanned, quarantined")) {
    return {
      status: 400,
      body: {
        error: {
          code: "INVALID_DOCUMENT_EVIDENCE",
          message: "Only clean-scanned, active, and retained documents may serve as authoritative inspection evidence.",
        },
      },
    };
  }

  // 8. Scope / Link Validation Failures
  if (
    msg.includes("asset_building_scope_invalid") ||
    msg.includes("asset_unit_scope_invalid") ||
    msg.includes("asset_meter_scope_invalid") ||
    msg.includes("asset_access_point_scope_invalid") ||
    msg.includes("asset_vendor_scope_invalid") ||
    msg.includes("asset_contract_scope_invalid") ||
    msg.includes("replacement_asset_not_found")
  ) {
    return {
      status: 400,
      body: {
        error: {
          code: "CANONICAL_LINK_INVALID",
          message: `Canonical link validation failed: ${err.message}`,
        },
      },
    };
  }

  // 9. Single-Winner Stale / Concurrent Update Failures
  if (msg.includes("downtime_not_active")) {
    return {
      status: 409,
      body: {
        error: {
          code: "DOWNTIME_NOT_ACTIVE",
          message: "Active downtime session was already closed or not found.",
        },
      },
    };
  }

  // 10. Not Found
  if (
    msg.includes("asset_not_found") ||
    msg.includes("policy_not_found") ||
    msg.includes("inspection_not_found") ||
    msg.includes("warranty_not_found") ||
    msg.includes("claim_not_found") ||
    msg.includes("request_not_pending")
  ) {
    return {
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: err.message || "Requested asset entity not found.",
        },
      },
    };
  }

  // Default fallback
  return {
    status: 500,
    body: {
      error: {
        code: "ASSET_OPERATION_FAILED",
        message: err.message || "An unexpected error occurred during asset processing.",
      },
    },
  };
}

/**
 * Defense-in-depth projection filter for resident/owner roles.
 * Strips serial numbers, acquisition/replacement costs, commercial warranty details,
 * access point credentials, and internal vendor links.
 */
export function sanitizeAssetForRestrictedRoles(asset: any): any {
  if (!asset) return asset;
  const {
    serial_number_encrypted,
    serial_fingerprint,
    replacement_cost,
    currency,
    warranty,
    access_point_id,
    vendor_id,
    service_contract_id,
    ...safeProps
  } = asset;

  return safeProps;
}
