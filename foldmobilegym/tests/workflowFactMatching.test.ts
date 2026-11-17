import {describe,it,expect} from 'vitest';
import {includesWorkflowFacts,judgeWorkflow,type WorkflowContract} from '../foldagent_workflow_contract';

describe('opt-in result formatting tolerance',()=>{
  it('separates a correct amount from a substring of an incorrect amount',()=>{
    for(const text of ['1899元','8991元','899.5元','0.899元'])
      expect(includesWorkflowFacts(text,[['899','899.00']],true)).toBe(false);
    for(const text of ['售价 899 元','价格：８９９．００元。','899.00 CNY'])
      expect(includesWorkflowFacts(text,[['899','899.00']],true)).toBe(true);
  });
  it('retains the legacy substring behavior when the contract does not opt in',()=>{
    expect(includesWorkflowFacts('1899元',[['899']])).toBe(true);
  });
  it('accepts title whitespace differences only in opted-in contracts',()=>{
    const contract:WorkflowContract={version:1,card:'formatting',source:{app:'source',selector:'main',facts:[['Alpha']]},
      target:{app:'notes',kind:'note',title:'采购 · 记录',route:'^/note/',field:'textarea',facts:[['Alpha']]},protected_paths:[]};
    const initial={apps:{notes:{notes:[],todos:[]}}};
    const current={apps:{notes:{notes:[{id:'new',title:' 采购·记录 ',content:'Alpha。'}],todos:[]}}};
    expect(judgeWorkflow(initial,current,contract).passed).toBe(false);
    contract.target.fact_matching='numeric_boundaries';
    expect(judgeWorkflow(initial,current,contract).passed).toBe(true);
    current.apps.notes.notes[0].title='另一个标题';
    expect(judgeWorkflow(initial,current,contract).passed).toBe(false);
  });
});
