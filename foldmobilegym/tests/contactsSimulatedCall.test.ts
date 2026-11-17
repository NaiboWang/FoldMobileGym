import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NAVIGATION_DECLARATION } from '../system/Contacts/navigation.declaration';
import { strings } from '../system/Contacts/res/strings';
import { stringsEn } from '../system/Contacts/res/strings.en';

describe('local simulated calling route', () => {
  it('pushes from the dialpad without changing a task or evaluator', () => {
    const route = NAVIGATION_DECLARATION.routes.find(item => item.path === '/calling');
    const open = NAVIGATION_DECLARATION.transitions.find(item => item.id === 'dialpad.simulatedCall.open');
    expect(route).toMatchObject({component:'SimulatedCallPage', queryParams:{number:'string',slot:'number'}});
    expect(open).toMatchObject({from:{path:'/',search:{dialpad:'true'}},to:'/calling',mode:'push',searchParams:{number:'string',slot:'number'}});
  });
  it('clearly distinguishes the local screen from real telephony in both languages', () => {
    expect(strings.simulated_call_status).toContain('不会拨打真实电话');
    expect(stringsEn.simulated_call_status).toContain('no real call');
    const source=readFileSync(new URL('../system/Contacts/pages/SimulatedCallPage.tsx',import.meta.url),'utf8');
    expect(source).toContain('data-simulated-call-end');
    expect(source).toContain('data-navigation-bar-foreground="light"');
    expect(source).not.toContain('getUserMedia');
    expect(source).not.toContain('tel:');
    expect(source).not.toContain('getUserMedia');
    expect(source).toContain('data-simulated-call-control={index === 4 ? \'mute\' : index === 8 ? \'speaker\' : undefined}');
  });
});
