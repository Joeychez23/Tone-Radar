// Sample messages for trying the app.
export const EXAMPLES = [
  {
    id: "overdue",
    name: "The overdue report",
    audience: "peer",
    channel: "email",
    text: `Hi Sam,

Per my last email, the Q3 report was due Friday. I just wanted to maybe check if you had a chance to possibly look at it, if that's okay?

Your team dropped the ball on the vendor contract again, so I'd rather not have a repeat. Can someone look into this?

Thanks for finally getting back to me on the budget, by the way.

Best,
Alex`,
  },
  {
    id: "review",
    name: "Code review comment",
    audience: "peer",
    channel: "review",
    text: `Why didn't you add tests for this?? As I already mentioned in the last PR, we need coverage on the payment paths. Obviously this will break in production. I think maybe the retry logic is sort of off too, but I could be wrong. Kindly fix before merging.`,
  },
  {
    id: "slack",
    name: "Slack nudge",
    audience: "team",
    channel: "chat",
    text: `hey all, bumping this again. not sure if you saw my message yesterday but someone should update the on-call doc. would be great if it happened soonish. thanks in advance!`,
  },
  {
    id: "customer",
    name: "Customer escalation reply",
    audience: "customer",
    channel: "email",
    text: `Hello Priya,

As you should know, our SLA only covers business hours. The outage was caused by your team's misconfigured webhook, not our platform. That said, we restored service at 4:12pm and have added monitoring so we catch this faster.

Could you confirm the new webhook URL with our support team by Thursday so we can close this out?

Regards,
Jordan`,
  },
  {
    id: "good",
    name: "A message that's ready",
    audience: "report",
    channel: "chat",
    text: `Great job on the launch yesterday, the customer feedback has been really positive. Could you share the rollout metrics with Dana by 3pm Thursday? I'd like to include them in Friday's update.`,
  },
];
