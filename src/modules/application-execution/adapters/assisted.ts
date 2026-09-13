import { publicMappedFields } from "../redact.js";
import type { ExecutionContext, PortalApplicationAdapter } from "../types.js";

/**
 * Fallback for sources without a tested, permitted apply integration.
 * It never fills a remote form and never claims a portal is supported.
 */
export class AssistedUrlAdapter implements PortalApplicationAdapter {
  readonly source = "assisted";
  readonly testedAgainstPortal = false;

  supports(): boolean {
    return true;
  }

  async apply(ctx: ExecutionContext) {
    const applicationUrl = ctx.application.applicationUrl || ctx.application.job.canonicalUrl;
    return {
      status: "REQUIRES_USER_ACTION" as const,
      adapter: this.source,
      testedAgainstPortal: this.testedAgainstPortal,
      applicationUrl,
      message:
        "No permitted portal adapter has been tested for this job source. Open the employer URL yourself. Harbor will not log in, solve CAPTCHA/OTP/MFA, or submit.",
      mappedFields: publicMappedFields([]),
      checkpoints: [
        {
          reason: "manual_submit" as const,
          message: "Continue on the employer site. Harbor does not automate this portal.",
        },
        {
          reason: "login" as const,
          message: "If the portal asks you to sign in, do that yourself. Passwords are not stored.",
        },
      ],
      retryable: true,
    };
  }
}
