// Server-only: sender settings for Email campaigns, from env with the
// defaults decided 2026-10-05 (see CLAUDE.md "Email campaigns").
import { SenderSettings } from "./emailCampaigns";

export function getSenderSettings(): SenderSettings {
  return {
    fromAddress: process.env.EMAIL_FROM_ADDRESS || "hello@atlasnetwork.club",
    replyTo: process.env.EMAIL_REPLY_TO || "olamprianidis@gmail.com",
    mailingAddress: process.env.EMAIL_MAILING_ADDRESS || "433 N Camden Dr, Beverly Hills, CA 90210",
  };
}
