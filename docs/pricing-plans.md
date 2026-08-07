# Xero Power Pricing Plans

## Positioning

Xero Power uses a three-plan model:

| Plan | Price | Target user | Positioning |
|------|-------|-------------|-------------|
| Free | $0 | Any Xero user | Daily productivity and distribution |
| Solo Pro | $14.99/month | Solo bookkeepers and Xero power users | Personal workflow customization |
| Practice Pro | $44.99/month | Bookkeeping and accounting practices | Approval guardrails and practice quality control |

## Feature split

| Feature | Free | Solo Pro | Practice Pro |
|---------|------|----------|--------------|
| Command palette | Yes | Yes | Yes |
| 39 Xero destinations | Yes | Yes | Yes |
| Most Used learning | Yes | Yes | Yes |
| Bank Rec shortcuts | Yes | Yes | Yes |
| Invoices default to Approve only | Yes | Yes | Yes |
| Dark mode | Yes | Yes | Yes |
| Organisation colours | 2 organisations | Unlimited | Unlimited |
| Custom keyboard shortcuts | No | Yes | Yes |
| Multi-organisation workspace launcher | No | Yes | Yes |
| Page controls above long lists | No | Yes | Yes |
| Remember items-per-page settings | No | Yes | Yes |
| Require tracking category before approval | No | No | Yes |
| Require line descriptions before approval | No | No | Yes |
| Awaiting Approval queue watch and local notifications | No | No | Yes |
| Find & Recode Description review index | No | No | Yes |
| Support | Standard | Priority email | Practice-level |

## Implementation notes

- `xp_plan` is the tier key: `free`, `pro`, or `practice`.
- `xp_pro` remains as a paid-plan boolean for backward compatibility.
- Existing users with `xp_pro: true` and no `xp_plan` are treated as `practice`, because the old paid plan was priced at $44.99/month.
- Solo Pro and Practice Pro each use a dedicated Polar product, checkout link, and license-key benefit.
- License validation checks the benefit tied to each plan so Solo licenses cannot unlock Practice-only guardrails.
- Settings links paid customers to Polar's hosted Customer Portal for cancellation, payment-method changes, invoices, and receipts. Local deactivation is labelled separately and does not imply billing cancellation.
- Saved non-owner licenses are revalidated when Chrome starts (throttled to once per six hours) and by a 24-hour alarm. A definitive invalid response removes paid access; network and Polar service failures do not.
- Revalidation checks Practice before Solo, so a plan change updates `xp_plan` to the highest valid tier returned by the dedicated benefits.
- Approval Watch records only counts visible on Xero list pages. It does not poll the Xero API, and notifications require an optional Chrome permission requested when the user enables the feature.
- The Find & Recode index reads descriptions on the current visible page locally and does not store or reorder Xero transaction rows.
