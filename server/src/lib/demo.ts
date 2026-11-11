// Demo accounts created by `npm run seed:demo`. Shared by the seed script and the demo-login route
// so the two can never drift apart.

export const DEMO_ACCOUNTS = [
  {
    key: 'lawyer',
    email: 'mehta@courtcall.demo',
    name: 'Adv. Rakesh Mehta',
    label: 'Senior lawyer',
    description: 'Mehta & Associates: dashboard, clients, cases, team approvals, client chat',
  },
  {
    key: 'junior',
    email: 'priya@courtcall.demo',
    name: 'Priya Shah',
    label: 'Junior lawyer',
    description: 'Reports live progress from Court 4 and Court 7',
  },
  {
    key: 'lawyer2',
    email: 'desai@courtcall.demo',
    name: 'Adv. Nisha Desai',
    label: 'Senior lawyer (2nd office)',
    description: 'Desai Law Chambers: shares Court 4 with Mehta & Associates',
  },
  {
    key: 'junior2',
    email: 'arjun@courtcall.demo',
    name: 'Arjun Trivedi',
    label: 'Junior lawyer (2nd office)',
    description: 'Reports in the same shared Court 4 room from another office',
  },
  {
    key: 'admin',
    email: 'admin@courtcall.demo',
    name: 'CourtCall Admin',
    label: 'CourtCall team',
    description: 'Not a firm role: checks new lawyers’ Bar Council numbers before they can join',
  },
] as const

export type DemoKey = (typeof DEMO_ACCOUNTS)[number]['key']
