import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import {coordinate,phases} from '../skills/woia-legal-compliance/scripts/coordinate.mjs';
const schema=JSON.parse(fs.readFileSync(new URL('../skills/woia-legal-compliance/references/coordination.schema.json',import.meta.url)));
const validate=new Ajv({allErrors:true,strict:true}).compile(schema);
const base=()=>({phase:'scope',actor_ref:'caller-1',evaluated_at:100,operation_id:'operation-1',matter_ref:'matter-1',organization_ref:'org-1',access:{organization_ref:'org-1',matter_ref:'matter-1',purpose:'bounded review',fields:['version'],allowed:true},source:{organization_ref:'org-1',matter_ref:'matter-1',map_version:'map-1',evidence_ref:'evidence-1',source_version:'source-1',fresh:true,accepted:true,conflict:false},authority:{actor_ref:'caller-1',organization_ref:'org-1',matter_ref:'matter-1',operation_id:'operation-1',phase:'scope',document_version:'doc-v1',valid_from:1,valid_until:200,permitted:true,grant_ref:'grant-1',revoked:false,takeover:false},outcome:'KNOWN',external_contact:false,applicability:'ACCEPTED',document:{version:'doc-v1',template_ref:'template-v1',input_ref:'accepted-input',template_accepted:true,checksum:'hash-1'},decision:{organization_ref:'org-1',matter_ref:'matter-1',operation_id:'operation-1',actor_ref:'principal-1',power_ref:'power-1',competent:true,accepted:true,document_version:'doc-v1',material_change:false,revoked:false,independent_review_required:false},professional_required:false,retention:{policy_ref:'policy-v1',decision_ref:'retention-1',accepted:true,derivatives_covered:true,hold:false,disposal_requested:false}});
for(const phase of phases)test(`${phase} bounded coordination does not assert effects or validity`,()=>{const x=base();x.phase=phase;x.authority.phase=phase;assert.equal(validate(x),true,JSON.stringify(validate.errors));const before=structuredClone(x);const result=coordinate(x);assert.equal(result.result,'COORDINATION_READY');assert.equal(result.dispatch,false);assert.equal(result.business_completion,false);assert.equal(result.legal_validity_claimed,false);assert.deepEqual(x,before);});
const negatives=[
 ['missing operation',x=>delete x.operation_id,'MISSING_REFERENCES'],
 ['cross organization',x=>x.access.organization_ref='other','SCOPED_ACCESS_REQUIRED'],
 ['cross matter',x=>x.access.matter_ref='other','SCOPED_ACCESS_REQUIRED'],
 ['wildcard fields',x=>x.access.fields=['*'],'SCOPED_ACCESS_REQUIRED'],
 ['denied access',x=>x.access.allowed=false,'SCOPED_ACCESS_REQUIRED'],
 ['source conflict',x=>x.source.conflict=true,'SOURCE_AUTHORITY_UNRESOLVED'],
 ['source stale',x=>x.source.fresh=false,'SOURCE_AUTHORITY_UNRESOLVED'],
 ['source missing map',x=>delete x.source.map_version,'SOURCE_AUTHORITY_UNRESOLVED'],
 ['evidence not accepted',x=>x.source.accepted=false,'SOURCE_AUTHORITY_UNRESOLVED'],
 ['revocation',x=>x.authority.revoked=true,'CURRENT_AUTHORITY_REQUIRED'],
 ['takeover',x=>x.authority.takeover=true,'CURRENT_AUTHORITY_REQUIRED'],
 ['no grant',x=>delete x.authority.grant_ref,'AUTHORITY_REQUIRED'],
 ['no authority',x=>x.authority.permitted=false,'AUTHORITY_REQUIRED'],
 ['unknown applicability',x=>x.applicability='UNKNOWN','APPLICABILITY_REQUIRES_COMPETENT_SOURCE'],
 ['unapproved template',x=>{x.phase='documents';x.document.template_accepted=false;},'ACCEPTED_TEMPLATE_AND_INPUTS_REQUIRED'],
 ['version change',x=>{x.phase='decision';x.document.version='doc-v2';x.authority.document_version='doc-v2';},'EXACT_COMPETENT_DECISION_REQUIRED'],
 ['material change',x=>{x.phase='decision';x.decision.material_change=true;},'EXACT_COMPETENT_DECISION_REQUIRED'],
 ['incompetent actor',x=>{x.phase='decision';x.decision.competent=false;},'EXACT_COMPETENT_DECISION_REQUIRED'],
 ['revoked decision',x=>{x.phase='decision';x.decision.revoked=true;},'EXACT_COMPETENT_DECISION_REQUIRED'],
 ['one actor two roles',x=>{x.phase='decision';x.authority.phase=x.phase;Object.assign(x.decision,{independent_review_required:true,reviewer_ref:'principal-1',reviewer_competent:true});},'DISTINCT_COMPETENT_REVIEWER_REQUIRED'],
 ['unattributed professional',x=>{x.phase='formalization';x.professional_required=true;x.professional={result_ref:'result',attributable:false};},'ATTRIBUTABLE_RESULT_REQUIRED'],
 ['held disposal',x=>{x.phase='lifecycle';x.retention.hold=true;x.retention.disposal_requested=true;x.retention.disposal_authorized=true;},'HOLD_OR_DISPOSAL_AUTHORITY'],
 ['unauthorized disposal',x=>{x.phase='lifecycle';x.retention.disposal_requested=true;},'HOLD_OR_DISPOSAL_AUTHORITY'],
 ['derivatives uncovered',x=>{x.phase='lifecycle';x.retention.derivatives_covered=false;},'RETENTION_CONTRACT_REQUIRED']
];
for(const [name,mutate,code] of negatives)test(name,()=>{const x=base();mutate(x);x.authority.phase=x.phase;assert.equal(coordinate(x).code,code);});
test('unknown result reconciles same identity before any retry',()=>{const x=base();x.outcome='UNKNOWN';assert.deepEqual(coordinate(x),{result:'RECONCILE',code:'RECONCILE_BEFORE_RETRY',operation_id:'operation-1',dispatch:false});});
test('external professionals route to Customer Service without dispatch',()=>{const x=base();x.external_contact=true;assert.equal(coordinate(x).receiver,'customer-service');assert.equal(coordinate(x).dispatch,false);});
test('routine approved drafting has no protected decision ceremony',()=>{const x=base();x.phase='documents';x.authority.phase=x.phase;delete x.decision;assert.equal(coordinate(x).result,'COORDINATION_READY');});
test('distinct competent review passes configured requirement',()=>{const x=base();x.phase='decision';x.authority.phase=x.phase;Object.assign(x.decision,{independent_review_required:true,reviewer_ref:'principal-2',reviewer_competent:true});assert.equal(coordinate(x).result,'COORDINATION_READY');});
test('schema rejects invented field and broad access',()=>{const x=base();x.dispatch=true;assert.equal(validate(x),false);delete x.dispatch;x.access.fields=['*'];assert.equal(validate(x),false);});
test('native department manifest requires Core 0.5.3 and generic identity',()=>{const x=JSON.parse(fs.readFileSync(new URL('../dev.woia/manifest.json',import.meta.url)));assert.equal(x.schema,'dev.woia.department-orchestrator/v1');assert.deepEqual(x.requires_plugins,[{name:'woia-core',minimum_version:'0.5.3'}]);assert.equal(x.department,'legal-compliance');});
for(const [field,value] of [['actor_ref','other'],['organization_ref','other'],['matter_ref','other'],['operation_id','other'],['phase','lifecycle'],['document_version','other']])test(`grant rejects mismatched ${field}`,()=>{const x=base();x.authority[field]=value;assert.equal(coordinate(x).code,'GRANT_SCOPE_MISMATCH');});
for(const [name,mutate] of [['expired',x=>x.evaluated_at=200],['future',x=>x.evaluated_at=0],['no current evaluation',x=>delete x.evaluated_at],['invalid interval',x=>x.authority.valid_until=0]])test(`grant ${name}`,()=>{const x=base();mutate(x);assert.equal(coordinate(x).code,'GRANT_WINDOW_INVALID');});
for(const field of ['organization_ref','matter_ref','operation_id'])test(`decision rejects mismatched ${field}`,()=>{const x=base();x.phase='decision';x.authority.phase=x.phase;x.decision[field]='other';assert.equal(coordinate(x).code,'EXACT_COMPETENT_DECISION_REQUIRED');});
for(const field of ['organization_ref','matter_ref'])test(`source cannot cross ${field}`,()=>{const x=base();x.source[field]='other';assert.equal(coordinate(x).code,'SOURCE_AUTHORITY_UNRESOLVED');});
test('duplicate field scope rejected',()=>{const x=base();x.access.fields=['version','version'];assert.equal(coordinate(x).code,'SCOPED_ACCESS_REQUIRED');});
