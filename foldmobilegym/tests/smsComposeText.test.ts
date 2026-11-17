import {describe,expect,it} from 'vitest';
import {smsComposeRows} from '../system/Sms/composeText';
describe('SMS multiline compose presentation preserves original body',()=>{
 for(const [text,rows] of [['',1],['one',1],['first\nsecond',2],['first\n\nthird',3],['a\nb\nc\nd',4],['a\nb\nc\nd\ne',4],['a\r\nb\r\nc',3],['a\rb',2],['中文 📝\nLine two',2]] as const){it(JSON.stringify(text),()=>{expect(smsComposeRows(text)).toBe(rows);expect(typeof text).toBe('string');});}
});
