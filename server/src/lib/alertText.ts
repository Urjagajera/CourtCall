// Client alert wording in each supported language. Fixed templates only: never a predicted time.
// English must stay word-for-word in sync with the unit tests (alertRules.test.ts).
export type Lang = 'en' | 'hi' | 'gu'

export interface AlertVars {
  court: string // room number, e.g. "4"
  mine: number
  cur: number | null
  away: number | null
}

type Templates = Record<
  'now_hearing' | 'passed_over' | 'recalled' | 'adjourned' | 'not_sitting' | 'risen' | 'break' | 'moved_past' | 'close' | 'within' | 'first',
  (v: AlertVars) => string
>

const en: Templates = {
  now_hearing: (v) => `Your case (Item ${v.mine}) is being heard now in Court ${v.court}.`,
  passed_over: (v) => `Your case (Item ${v.mine}) was passed over in Court ${v.court}. It may be called again later. Your lawyer will update you.`,
  recalled: (v) => `Your case (Item ${v.mine}) has been recalled and is being heard now in Court ${v.court}.`,
  adjourned: (v) => `Your case (Item ${v.mine}) was adjourned in Court ${v.court}. Your lawyer will share the next date.`,
  not_sitting: (v) => `Court ${v.court} is not sitting today. Your lawyer will update you.`,
  risen: (v) => `Court ${v.court} has risen for the day. Your lawyer will update you.`,
  break: (v) => `Court ${v.court} is on a short break. Latest progress: Item ${v.cur}. Yours is Item ${v.mine}.`,
  moved_past: (v) => `Court ${v.court} has moved past your item (now Item ${v.cur}). Your lawyer will update you.`,
  close: (v) => `Your case is close: Court ${v.court} is at Item ${v.cur}, yours is Item ${v.mine} (${v.away} away). Be near the courtroom.`,
  within: (v) => `Court ${v.court} is at Item ${v.cur}. Your case is Item ${v.mine} (${v.away} away). Get ready.`,
  first: (v) => `Court ${v.court} has started. Now: Item ${v.cur}. Your case is Item ${v.mine} (${v.away} away).`,
}

const hi: Templates = {
  now_hearing: (v) => `आपके केस (आइटम ${v.mine}) की सुनवाई अभी कोर्ट ${v.court} में चल रही है।`,
  passed_over: (v) => `आपका केस (आइटम ${v.mine}) कोर्ट ${v.court} में पास ओवर हुआ। इसे बाद में फिर बुलाया जा सकता है। आपके वकील आपको बताएँगे।`,
  recalled: (v) => `आपका केस (आइटम ${v.mine}) फिर से बुलाया गया है और अभी कोर्ट ${v.court} में सुनवाई चल रही है।`,
  adjourned: (v) => `आपका केस (आइटम ${v.mine}) कोर्ट ${v.court} में स्थगित हुआ। आपके वकील अगली तारीख बताएँगे।`,
  not_sitting: (v) => `कोर्ट ${v.court} आज नहीं बैठ रही है। आपके वकील आपको बताएँगे।`,
  risen: (v) => `कोर्ट ${v.court} आज के लिए उठ गई है। आपके वकील आपको बताएँगे।`,
  break: (v) => `कोर्ट ${v.court} में छोटा ब्रेक है। अभी तक: आइटम ${v.cur}। आपका आइटम ${v.mine} है।`,
  moved_past: (v) => `कोर्ट ${v.court} आपके आइटम से आगे निकल गई है (अभी आइटम ${v.cur})। आपके वकील आपको बताएँगे।`,
  close: (v) => `आपका केस करीब है: कोर्ट ${v.court} में आइटम ${v.cur} चल रहा है, आपका आइटम ${v.mine} है (${v.away} बाकी)। कोर्टरूम के पास रहें।`,
  within: (v) => `कोर्ट ${v.court} में आइटम ${v.cur} चल रहा है। आपका केस आइटम ${v.mine} है (${v.away} बाकी)। तैयार रहें।`,
  first: (v) => `कोर्ट ${v.court} शुरू हो गई है। अभी: आइटम ${v.cur}। आपका केस आइटम ${v.mine} है (${v.away} बाकी)।`,
}

const gu: Templates = {
  now_hearing: (v) => `તમારા કેસ (આઇટમ ${v.mine})ની સુનાવણી હમણાં કોર્ટ ${v.court}માં ચાલી રહી છે.`,
  passed_over: (v) => `તમારો કેસ (આઇટમ ${v.mine}) કોર્ટ ${v.court}માં પાસ ઓવર થયો. તે પછીથી ફરી બોલાવાઈ શકે છે. તમારા વકીલ તમને જણાવશે.`,
  recalled: (v) => `તમારો કેસ (આઇટમ ${v.mine}) ફરી બોલાવાયો છે અને હમણાં કોર્ટ ${v.court}માં સુનાવણી ચાલી રહી છે.`,
  adjourned: (v) => `તમારો કેસ (આઇટમ ${v.mine}) કોર્ટ ${v.court}માં મુલતવી રહ્યો. તમારા વકીલ આગલી તારીખ જણાવશે.`,
  not_sitting: (v) => `કોર્ટ ${v.court} આજે બેસતી નથી. તમારા વકીલ તમને જણાવશે.`,
  risen: (v) => `કોર્ટ ${v.court} આજના દિવસ માટે ઊઠી ગઈ છે. તમારા વકીલ તમને જણાવશે.`,
  break: (v) => `કોર્ટ ${v.court}માં ટૂંકો વિરામ છે. અત્યાર સુધી: આઇટમ ${v.cur}. તમારી આઇટમ ${v.mine} છે.`,
  moved_past: (v) => `કોર્ટ ${v.court} તમારી આઇટમથી આગળ વધી ગઈ છે (હમણાં આઇટમ ${v.cur}). તમારા વકીલ તમને જણાવશે.`,
  close: (v) => `તમારો કેસ નજીક છે: કોર્ટ ${v.court}માં આઇટમ ${v.cur} ચાલે છે, તમારી આઇટમ ${v.mine} છે (${v.away} બાકી). કોર્ટરૂમની નજીક રહો.`,
  within: (v) => `કોર્ટ ${v.court}માં આઇટમ ${v.cur} ચાલે છે. તમારો કેસ આઇટમ ${v.mine} છે (${v.away} બાકી). તૈયાર રહો.`,
  first: (v) => `કોર્ટ ${v.court} શરૂ થઈ ગઈ છે. હમણાં: આઇટમ ${v.cur}. તમારો કેસ આઇટમ ${v.mine} છે (${v.away} બાકી).`,
}

export const ALERT_TEXT: Record<Lang, Templates> = { en, hi, gu }
