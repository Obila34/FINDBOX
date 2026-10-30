import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
const dateOnly=v=>typeof v==='string'?v.slice(0,10):[v.getFullYear(),String(v.getMonth()+1).padStart(2,'0'),String(v.getDate()).padStart(2,'0')].join('-');
const amount=n=>'KES '+(n/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});
export async function invoicePdf(invoice) {
 const doc=new PDFDocument({size:'A4',margin:48,info:{Title:'FindBox '+(invoice.number||'Draft invoice'),Author:'FindBox'}});
 const chunks=[];const done=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)});
 doc.registerFont('Vera',fileURLToPath(new URL('./assets/Vera.ttf',import.meta.url))).font('Vera');
 const W=499,green='#174e3b',gray='#64766d';let page=0;
 const header=()=>{page++;doc.image(fileURLToPath(new URL('./assets/findbox-mark.png',import.meta.url)),48,39,{width:35});doc.image(fileURLToPath(new URL('./assets/findbox-logo.png',import.meta.url)),92,48,{width:130});doc.fillColor(green).fontSize(11).text(invoice.status==='draft'?'DRAFT / PRO FORMA':invoice.status==='proforma'?'PRO FORMA INVOICE':'COMMERCIAL INVOICE',325,47,{width:220,align:'right'});doc.fontSize(9).fillColor(gray).text(invoice.number||invoice.id.slice(0,8).toUpperCase(),325,67,{width:220,align:'right'});doc.moveTo(48,92).lineTo(547,92).strokeColor('#dbe5de').stroke();doc.y=110;};
 const footer=()=>{const y=doc.y;doc.fontSize(8).fillColor(gray).text('Commercial document. Not a KRA eTIMS tax invoice. No payment is recorded by this document.',48,780,{width:470,lineBreak:false});doc.text(String(page),525,780,{width:20,lineBreak:false});doc.y=y;};
 const fresh=()=>{footer();doc.addPage();header();};header();
 const issuer=invoice.issuer||{},customer=invoice.customer||{};
 doc.fillColor(green).fontSize(10).text('FROM',48,112).text('BILL TO',310,112);
 doc.fillColor('#183c31').fontSize(12).text(issuer.legalName||'FindBox — business details pending',48,133,{width:235});const issuerY=doc.y;
 doc.fontSize(12).text(customer.name||'',310,133,{width:237});let customerY=doc.y;
 doc.fontSize(9).fillColor(gray).text([issuer.address,issuer.email,issuer.pin?'KRA PIN: '+issuer.pin:''].filter(Boolean).join('\n'),48,issuerY+8,{width:235});const leftEnd=doc.y;
 doc.text([customer.email,customer.address].filter(Boolean).join('\n'),310,customerY+8,{width:237});doc.y=Math.max(leftEnd,doc.y,185)+20;
 doc.fillColor(green).fontSize(10).text('Issued: '+(invoice.issued_at?new Date(invoice.issued_at).toISOString().slice(0,10):'Draft'),48,doc.y,{continued:true}).text('     Due: '+dateOnly(invoice.due_date));doc.moveDown(1.5);
 function tableHeader(){const y=doc.y;doc.roundedRect(48,y,W,28,5).fill(green);doc.fillColor('#fff').fontSize(9).text('DESCRIPTION',60,y+9,{width:265}).text('QTY',332,y+9,{width:35,align:'right'}).text('UNIT PRICE',380,y+9,{width:75,align:'right'}).text('TOTAL',465,y+9,{width:70,align:'right'});doc.y=y+36;}
 tableHeader();
 for(const line of invoice.lines){doc.fontSize(9);const h=Math.max(36,doc.heightOfString(line.description,{width:257})+18);if(doc.y+h>690){fresh();tableHeader();}const y=doc.y;doc.fillColor('#183c31').text(line.description,60,y,{width:257});doc.text(String(line.quantity),332,y,{width:35,align:'right'}).text(amount(line.unitMinor),375,y,{width:80,align:'right'}).text(amount(line.quantity*line.unitMinor),460,y,{width:75,align:'right'});doc.moveTo(48,y+h-9).lineTo(547,y+h-9).strokeColor('#e3ebe6').stroke();doc.y=y+h;}
 if(doc.y>620)fresh();let y=doc.y+12;doc.roundedRect(300,y,247,58,8).fill('#e3f1e8');doc.fillColor(green).fontSize(10).text(['draft','proforma'].includes(invoice.status)?'PRO FORMA TOTAL - KES':'TOTAL DUE - KES',315,y+12).fontSize(19).text(amount(invoice.total_minor),315,y+29,{width:217,align:'right'});doc.y=y+85;
 doc.fontSize(9).fillColor(gray).text(['draft','proforma'].includes(invoice.status)?'Tax details are pending. This estimate is for review and is not a tax invoice.':'No VAT is charged on this document. Payment arrangements must be confirmed directly with FindBox.',48,doc.y,{width:W});
 if(invoice.notes){doc.moveDown();const h=doc.heightOfString(invoice.notes,{width:W});if(doc.y+h>730)fresh();doc.fillColor(green).fontSize(10).text('NOTES');doc.moveDown(.4);doc.fillColor(gray).fontSize(9).text(invoice.notes,{width:W});}
 if(invoice.status==='void'){doc.fillColor('#ac3b35').fontSize(14).text('VOID — DO NOT PAY',48,doc.y+20);}
 footer();doc.end();return done;
}

