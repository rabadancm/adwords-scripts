
/*************************************
* Zero impressions alert (campaigns)
* Version 0.1
* Created By: Carlos Rabadan
**************************************/

var SEND_MAIL = true;
var TO = ['carlosr@semmantica.com']; //you can add more, separate with commas
var SUBJECT = 'Zero impressions alert - ' + _getDateString();
var FILE_NAME = 'zero_impressions_' + _getDateString() + '.csv';
var FIELD_SEPARATOR = ",";
var DATE_RANGE = 'YESTERDAY';


function main() {
      
  var bad_campaigns = [];

  var campaignsIterator = AdWordsApp
  .campaigns()
  .withCondition('Impressions = 0')
  .withCondition('Status = ENABLED')
  .forDateRange(DATE_RANGE)
  .orderBy('Name DESC')
  .get();

  var totalEntities = campaignsIterator.totalNumEntities();

  while (campaignsIterator.hasNext()) {
    var campaign = campaignsIterator.next();   
    bad_campaigns.push(campaign);   
  }
   



  /* Redacta el email y el informe adjunto */  
  if(bad_campaigns.length > 0 && SEND_MAIL) 
  {  
    var column_names = ['Name','ID','Budget','BiddingStrategyType'];
    var attachment = column_names.join(",")+"\n";
    for(var i in bad_campaigns) {
      attachment += _formatResults(bad_campaigns[i], FIELD_SEPARATOR);
    }
    var body = "Se han encontrado " + bad_campaigns.length + " campañas sin impresiones. Ver el informe adjunto para más detalles.";
      body+="\n" +                             
        "\nCampañas sin impresiones: "+bad_campaigns.length + 
        "\nRango de tiempo seleccionado: "+DATE_RANGE;

    reportMail(SUBJECT, body, attachment);
  }
     


  /* SUMMARY LOG */
  Logger.log("\n\n/////////////////////////////////////////////////////////////////////////\n");              
  Logger.log("Campañas sin impresiones: "+bad_campaigns.length);
  Logger.log("Rango de tiempo seleccionado: "+DATE_RANGE);
  Logger.log("\n/////////////////////////////////////////////////////////////////////////");

}
  



function _formatResults(e,SEP) {  

  var sep = (SEP)? SEP:",";    
  if(e && e.getEntityType()==='Campaign') {    
    return [e.getName(),
            e.getId(),
            e.getBudget().getAmount(),
            e.getBiddingStrategyType()                                         
           ].join(sep)+"\n";
   }  
}

function reportMail(mail_subject, mail_body, attachment) {    
  
  var options = { attachments: [Utilities.newBlob(attachment, 'text/csv', FILE_NAME)] };                 
  for(var i in TO) {
    MailApp.sendEmail(TO[i], mail_subject, mail_body, options);     
  }  
}
  
function _getDateString() {

  return Utilities.formatDate((new Date()), AdWordsApp.currentAccount().getTimeZone(), "ddMMyyyy_hhmmss");
}






