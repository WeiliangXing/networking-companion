// Default starting points for personal follow-ups. The model adapts them to verified context.
export const emailTemplates = [
 {
  id:'brief',name:'Brief & professional',
  use:'Default for a short introduction or when little conversation detail was saved.',
  subject:'Good connecting at [Event]',
  body:`Hi [First name],

It was a pleasure connecting at [Event]. Thank you for chatting with my AI companion.

I’d be glad to stay in touch and learn more about your work.

Best,
William`
 },
 {
  id:'warm',name:'Warm & personal',
  use:'A friendly conversation with a specific topic worth acknowledging.',
  subject:'Great meeting you, [First name]',
  body:`Hi [First name],

It was great meeting you at [Event]. Thanks for spending a few minutes with me and my AI companion—I enjoyed hearing about [specific topic].

I’d be glad to pick up the conversation another time.

Best,
William`
 },
 {
  id:'shared_interest',name:'Shared interest',
  use:'The saved conversation establishes a genuine shared interest, without implying a partnership.',
  subject:'Continuing our conversation about [Topic]',
  body:`Hi [First name],

Thank you for connecting at [Event] and chatting with my AI companion. Your perspective on [specific topic] stayed with me, especially [specific point].

I’d welcome the chance to exchange ideas as we explore [shared interest].

Best,
William`
 },
 {
  id:'next_step',name:'Agreed next step',
  use:'A concrete next step was explicitly agreed during the conversation. Never infer an agreement.',
  subject:'Following up on [Topic]',
  body:`Hi [First name],

It was good connecting at [Event]. Thanks for chatting with my AI companion about [specific topic].

As discussed, [accurate agreed next step]. [One practical question, only if needed to arrange it.]

Best,
William`
 }
];
export const emailTemplateGuidance = `DEFAULT FOLLOW-UP EMAIL TEMPLATES:
${emailTemplates.map(t=>`${t.name} (${t.id})\nChoose when: ${t.use}\nSubject: ${t.subject}\n${t.body}`).join('\n\n')}
When drafting a networking follow-up, choose the best-fitting template automatically; use Brief & professional if context is sparse. William can request a style by name, ask for alternatives, or change it by voice. Revise the same workspace card when changing style. Keep the body around 40–90 words (at most 120 unless asked for detail), professional, natural, and free of sales language. One optional invitation or question is enough. Each default acknowledges the recipient's experience chatting with William's AI companion in one short sentence; do not make the whole email about the technology. This reference is appropriate for contacts met through this companion. For other recipients, don't fabricate an interaction with the agent; adapt to the actual context.
Read the selected saved person's details before personalizing. Use only saved facts or William's explicit instructions. Missing name: use 'Hello,'. Missing event: say 'It was good connecting with you' without inventing an event. Do not assume every contact attended the currently configured event. If William supplies the event, use it. Omit unknown topic/specific point/shared interest; fall back to Brief & professional rather than leave bracket placeholders. Use the next-step version only for a verified agreement; don't invent a meeting, attachment, resource, deadline or partnership. Do not claim William heard or attended something absent from the context. Sign 'William'; don't add his employer or title unless requested. Follow any user-requested language. Create/update the draft in the workspace, but save only on a save hint and only send after an explicit send instruction and claim success only after the sending tool confirms it.`;
