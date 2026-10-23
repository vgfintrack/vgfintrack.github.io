import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, serverTimestamp, increment, Timestamp } from 'firebase/firestore';

const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const yes = async (p, m) => { try { await assertSucceeds(p); ok(true, m); } catch (e) { ok(false, m + ' — ' + e.message.slice(0, 120)); } };
const no = async (p, m) => { try { await assertFails(p); ok(true, m); } catch (e) { ok(false, m + ' (was allowed)'); } };

const env = await initializeTestEnvironment({
  projectId: 'demo-amrpotli',
  firestore: { rules: readFileSync(`${process.env.AMRPOTLI_SITE}/firebase/firestore.rules`, 'utf8'), host: '127.0.0.1', port: 8085 },
});
const as = (email) => env.authenticatedContext(email.replace(/\W/g, ''), { email, email_verified: true }).firestore();
const owner = as('vgfintrack@gmail.com');
const founder = as('sabbir@gmail.com');
const emp = as('rina@gmail.com');
const guest = as('guest@gmail.com');
const oldGuest = as('oldguest@gmail.com');
const stranger = as('random@gmail.com');
const unverified = env.authenticatedContext('x', { email: 'vgfintrack@gmail.com', email_verified: false }).firestore();
const app = env.unauthenticatedContext().firestore();

const day = (n) => Timestamp.fromMillis(Date.now() + n * 86400000);
const member = (name, role, extra = {}) => ({ name, role, sections: [], addedBy: 'vgfintrack@gmail.com', addedAt: Timestamp.now(), ...extra });

// ---- team
await yes(setDoc(doc(owner, 'team/sabbir@gmail.com'), member('Sabbir', 'founder')), 'owner adds a founder');
await no(setDoc(doc(owner, 'team/vgfintrack@gmail.com'), member('Me', 'founder')), 'nobody can add a team doc for the owner');
await no(setDoc(doc(unverified, 'team/x@gmail.com'), member('X', 'employee')), 'an unverified "owner" email is refused');
await yes(setDoc(doc(founder, 'team/rina@gmail.com'), member('Rina', 'employee', { sections: ['leads', 'costs'] })), 'founder adds an employee with sections');
await no(setDoc(doc(founder, 'team/sadat@gmail.com'), member('Sadat', 'founder')), 'founder cannot add another founder');
await yes(setDoc(doc(founder, 'team/guest@gmail.com'), member('Guest', 'guest', { sections: ['leads'], until: day(10) })), 'founder adds a guest with an end date');
await yes(setDoc(doc(owner, 'team/oldguest@gmail.com'), member('Old', 'guest', { sections: ['leads'], until: day(-1) })), 'owner adds an expired guest');
await no(setDoc(doc(emp, 'team/friend@gmail.com'), member('Friend', 'employee')), 'employee cannot add people');
await no(updateDoc(doc(founder, 'team/sabbir@gmail.com'), { role: 'founder', name: 'K' , sections: ['x']}), 'founder cannot change a founder (even self) beyond name');
await yes(updateDoc(doc(emp, 'team/rina@gmail.com'), { name: 'Rina Akter' }), 'a member can change their own name');
await no(updateDoc(doc(emp, 'team/rina@gmail.com'), { sections: ['leads', 'costs', 'limits'] }), 'a member cannot give themself sections');
await yes(getDocs(collection(emp, 'team')), 'members see the team list');
await no(getDocs(collection(stranger, 'team')), 'strangers do not');
await no(getDocs(collection(app, 'team')), 'the app does not');

// ---- sections
await yes(setDoc(doc(emp, 'leads/l1'), { name: 'Polashi Store', status: 'new' }), 'employee writes leads (given)');
await no(setDoc(doc(emp, 'promos/POLASHI'), { code: 'POLASHI' }), 'employee cannot write promos (not given)');
await no(getDocs(collection(emp, 'grants')), 'employee cannot read limits (not given)');
await yes(getDocs(collection(guest, 'leads')), 'guest reads leads (given)');
await no(setDoc(doc(guest, 'leads/l2'), { name: 'X' }), 'guest cannot write');
await no(getDocs(collection(oldGuest, 'leads')), 'expired guest is shut out');
await no(getDocs(collection(stranger, 'leads')), 'strangers cannot read leads');
await yes(setDoc(doc(founder, 'grants/friend@gmail.com'), { limit: 50 }), 'founder sets an extra limit');
await yes(setDoc(doc(owner, 'public/limits'), { salt: 's', grants: { abc: { limit: 50 } } }), 'owner publishes the scrambled limits list');
await no(setDoc(doc(emp, 'public/limits'), { salt: 's', grants: {} }), 'employee without Limits cannot publish it');
await no(setDoc(doc(emp, 'public/notice'), { on: true }), 'employee without Notices cannot change the notice');
await yes(setDoc(doc(owner, 'public/notice'), { on: true, en: 'New: receipt photos', bn: 'নতুন: রসিদের ছবি', id: 1 }), 'owner sets the notice');

// ---- what the app can do (no sign-in)
await yes(getDoc(doc(app, 'public/limits')), 'the app reads the limits list');
await yes(getDocs(collection(app, 'public')), 'the app reads both public documents in one go');
await no(setDoc(doc(app, 'public/notice'), { on: false }), 'the app cannot change the notice');
await no(getDocs(collection(app, 'grants')), 'the app cannot read emails in the private limits list');
await yes(setDoc(doc(app, 'stats/2026-10-23'), { active: increment(1), bn: increment(1), voice: increment(1) }), 'the app adds the first count of the day');
await yes(setDoc(doc(app, 'stats/2026-10-23'), { active: increment(1), en: increment(1) }, { merge: true }), 'another phone adds 1');
await no(setDoc(doc(app, 'stats/2026-10-23'), { active: increment(5) }, { merge: true }), 'cannot add 5 at once');
await no(setDoc(doc(app, 'stats/2026-10-23'), { active: increment(1), email: 'x@y.z' }, { merge: true }), 'cannot add other fields (like an email)');
await no(setDoc(doc(app, 'stats/2026-10-23'), { en: increment(1) }, { merge: true }), 'every count must also count as active');
await no(setDoc(doc(app, 'stats/hello'), { active: 1 }), 'day must look like a date');
await no(getDoc(doc(app, 'stats/2026-10-23')), 'the app cannot read counts');
await no(getDoc(doc(emp, 'stats/2026-10-23')), 'employee without Users cannot read counts');
await yes(getDoc(doc(founder, 'stats/2026-10-23')), 'founder reads counts');
await yes(setDoc(doc(app, 'stats/2026-10-23'), { active: increment(1), team: increment(1) }, { merge: true }), 'team shops are counted');
// ---- kinds of work
await yes(setDoc(doc(app, 'profs/2026-10-23~pharmacy'), { n: increment(1) }), 'the app adds 1 for its kind of work');
await yes(setDoc(doc(app, 'profs/2026-10-23~pharmacy'), { n: increment(1) }, { merge: true }), 'another pharmacy adds 1');
await yes(setDoc(doc(app, 'profs/2026-10-23~custom'), { n: increment(1) }), 'typed professions count as custom');
await no(setDoc(doc(app, 'profs/2026-10-23~pharmacy'), { n: increment(3) }, { merge: true }), 'cannot add 3 at once');
await no(setDoc(doc(app, 'profs/2026-10-23~Rahim Pharmacy Dhaka'), { n: increment(1) }), 'no typed words in the id');
await no(setDoc(doc(app, 'profs/2026-10-23~job'), { n: increment(1), email: 'x@y.z' }), 'no other fields');
await no(setDoc(doc(app, 'profs/hello~job'), { n: increment(1) }), 'id must start with a date');
await no(getDoc(doc(app, 'profs/2026-10-23~pharmacy')), 'the app cannot read them');
await yes(getDoc(doc(founder, 'profs/2026-10-23~pharmacy')), 'founder reads them');

const optin = { name: 'Rahim', email: 'rahim@gmail.com', why: 'tester', code: 'POLASHI', profession: 'Grocery shop', lang: 'bn', mode: 'shop', app: '2026.10.23', at: serverTimestamp() };
await yes(addDoc(collection(app, 'optins'), optin), 'a user opts in from the app');
await no(addDoc(collection(app, 'optins'), { ...optin, balance: 5000 }), 'an opt-in cannot carry other data');
await no(addDoc(collection(app, 'optins'), { ...optin, email: 'not an email' }), 'email must look like one');
await no(getDocs(collection(app, 'optins')), 'the app cannot read opt-ins');
await yes(getDocs(collection(owner, 'optins')), 'owner reads opt-ins');

const fb = { kind: 'idea', text: 'Please add stock count', contact: '', from: 'app', app: '2026.10.23', lang: 'en', at: serverTimestamp() };
await yes(addDoc(collection(app, 'feedback'), fb), 'feedback from the app');
await no(addDoc(collection(app, 'feedback'), { ...fb, text: 'x'.repeat(2001) }), 'feedback over 2000 letters refused');
await no(getDocs(collection(app, 'feedback')), 'the app cannot read feedback');

// ---- tasks and activity
await yes(setDoc(doc(founder, 'tasks/t1'), { title: 'Visit Polashi shops', assignee: 'guest@gmail.com', status: 'todo', createdBy: 'sabbir@gmail.com' }), 'founder creates a task');
await yes(updateDoc(doc(guest, 'tasks/t1'), { status: 'doing', updatedAt: 1, updatedBy: 'guest@gmail.com' }), 'the person given a task can move it');
await no(updateDoc(doc(guest, 'tasks/t1'), { title: 'Changed' }), '…but not rename it');
await no(setDoc(doc(guest, 'tasks/t2'), { title: 'x', createdBy: 'guest@gmail.com' }), 'guests cannot create tasks');
await yes(addDoc(collection(emp, 'activity'), { by: 'rina@gmail.com', what: 'lead add', at: serverTimestamp() }), 'members log their own activity');
await no(addDoc(collection(emp, 'activity'), { by: 'vgfintrack@gmail.com', what: 'x', at: serverTimestamp() }), 'nobody can log as someone else');
await no(getDocs(collection(emp, 'activity')), 'employees cannot read the activity log');
await yes(getDocs(collection(founder, 'activity')), 'founders can');

// ---- owner removes a founder; founder cannot remove the owner or founders
await no(deleteDoc(doc(founder, 'team/sabbir@gmail.com')), 'founder cannot remove a founder');
await yes(deleteDoc(doc(founder, 'team/rina@gmail.com')), 'founder removes an employee');
await no(getDocs(collection(emp, 'leads')), 'a removed employee loses access at once');
await env.cleanup();
