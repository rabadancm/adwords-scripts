
/********************************************************
* Find, tag and report broken SITELINKS in your account
* Version 0.3
* Created By: Carlos Rabadan
* Contact: carlosr@semmantica
********************************************************/

var ACCOUNT = "";
var SPREADSHEET_URL="";
var SHEET_NAME = 'Sheet1';
var MAX_EXEC_TIME = 1500000;//MAX=29mins (1740000ms), DEFAULT=25min (1500000ms)
var DATE_RANGE = "ALL_TIME";
var SEND_MAIL = false;
var TO = ['carlosr@semmantica.com']; //you can add more, separate with commas

var SUBJECT = 'Sitelink broken URLs report - '+ACCOUNT+' - '+ _getDateString();
var FILE_NAME = 'sitelink_bad_urls_' + _getDateString() + '.csv';
var FIELD_SEPARATOR = ",";
var SHEET_HEADER = ['RevisionTime','CampaignId','CampaignName','SitelinkId','SitelinkText','ResponseCode','SitelinkUrl'];
var HTTP_OPTIONS = {
  muteHttpExceptions:true,
  followRedirects: false
};

/* REPORT_LEVEL: ajusta el grado de error a monitorizar
* "verbose": todo
* "redirection": >299
* "error": >399 tambien -1 (url no reconocida) */
var REPORT_LEVEL_TIERS = {"none":0 , "verbose":1, "redirection":2, "error":3}
var REPORT_LEVEL = REPORT_LEVEL_TIERS.redirection; 


var shelper = new SHelper();


function main() {
    
  var revised_urls = [];  
  var badUrlMap = {};
  var ent_counter=0;
  var bad_counter=0;
  var totalEntities=0;
  var time1, time0=new Date().getTime(); //time flag    
  

  /* Obtiene las campañas a partir de la cuales obtendremos los sitelinks a comprobar */
  var campaignIter = getCampaigns();

   /* Obtiene el conjunto completo de entidades previamente revisadas para comparar */
  var checkedIds = getCheckedIds(shelper); 

  //reinicia el spreadsheet si esta vacio
  if(shelper.size() < 1) {  
    shelper.clearData();
    shelper.appendRow(SHEET_HEADER);
  }



  main_loop:
  while(campaignIter.hasNext()) 
  {
    //para cada campaign obtiene un iterador de sus sitelinks
    var campaign = campaignIter.next();
    var campaignSitelinkIterator = campaign.extensions().sitelinks().get();

    entity_loop:
    while(campaignSitelinkIterator.hasNext()) 
    {
      //CampaignSitelink iterator
      var entity = campaignSitelinkIterator.next();

      /* Controla el tiempo transcurrido para detener el script a tiempo */
      time1 = new Date().getTime(); 
      if((time1 - time0) > MAX_EXEC_TIME) {
        Logger.log("AVISO: tiempo de ejecución excedido, parando el script. Tiempo total: "+
          (time1-time0)/60000 +"min");  
        shelper.flush();
        break main_loop;      
      }
      

      //si la entidad ya esta en la spreadsheet la omite      
      if(entity.getId() in checkedIds)
        continue entity_loop; 

      ent_counter++;
                     

      /* Comprueba tanto la url normal como la mobile
         Adwords permite hasta un maximo de 20000 llamadas a UrlFetchApp.fetch al dia */
      var urls = [entity.urls().getFinalUrl(), entity.urls().getMobileFinalUrl()];

      urls_loop:
      for (var i=0; i<urls.length; i++) {
        if (urls[i]==null || !urls[i]) 
          continue urls_loop;                            
                
        var response_code=0;        
        var lastUrl = encodeURI(urls[i]);
                     
        try{                
          response_code = UrlFetchApp.fetch(lastUrl, HTTP_OPTIONS).getResponseCode();
        }catch(e) {
          //Something is wrong here, we should know about it.
          revised_urls.push({e : entity, code : -1});
          badUrlMap[lastUrl] = true;           
          continue entity_loop;
        }


        //identifica el tipo de error HTML
        switch(REPORT_LEVEL) {                       
          case 0: 
          default: break;          
          case 1: 
            revised_urls.push({e : entity, code : response_code});
            break;
          case 2: 
            if(response_code > 299) {
              revised_urls.push({e : entity, code : response_code});                   
              badUrlMap[lastUrl] = true;         
              bad_counter++;   
              saveEntityToSheet(entity, time0, response_code, lastUrl);             
            }
            break;
          case 3: 
            if(response_code > 399) {
              revised_urls.push({e : entity, code : response_code});                          
              badUrlMap[lastUrl] = true; 
              bad_counter++;
              saveEntityToSheet(entity, time0, response_code, lastUrl);               
            }
            break;
        }                        
      }//urls_loop      

    }//entity_loop  

  }//main_loop



  /* Redacta el email y el informe de urls adjunto */  
  if(revised_urls.length > 0 && SEND_MAIL) {  
    var column_names = SHEET_HEADER;
    var attachment = column_names.join(",")+"\n";
    for(var i in revised_urls) {
      attachment += _formatResults(revised_urls[i], FIELD_SEPARATOR);
    }
    var body = "Se han encontrado " + bad_counter + " URLs rotas. Ver el informe adjunto para más detalles.";
      body += "\nEntidades revisadas: " + ent_counter + "\nURLs con error: " + bad_counter;

    reportMail(SUBJECT, body, attachment);
  }
     


  /* SUMMARY LOG */
  Logger.log("\n\n/////////////////////////////////////////////////////////////////////////\n");    
  Logger.log("Entidades revisadas: "+ ent_counter);
  Logger.log("Entidades con error: "+ bad_counter);
  Logger.log("\n/////////////////////////////////////////////////////////////////////////");

}
  


function saveEntityToSheet(entity, time, response, url) {

  //guarda la entidad actual en el spreadsheet
  var row = [        
    time,
    entity.getCampaign().getId(),
    entity.getCampaign().getName(),
    entity.getId(),
    entity.getLinkText(),   
    response,
    url                       
  ];
  shelper.appendRow(row);

}

function getCheckedIds(shelper) {
  
  var ids = {};    
  if(shelper && shelper.size() > 1) {
    sitelinkIds = shelper.readColumnData('SitelinkId');    
    for(var i=0; i<sitelinkIds.length; i++)        
      ids[ sitelinkIds[i] ] = true;            
  }
  return ids;
}

function getCampaigns() {
  
    //obtiene las campaigns y despues sus sitelinks      
    return AdWordsApp.campaigns()
      .withCondition("Name DOES_NOT_CONTAIN 'ZZ_'")
      .withCondition("Status = ENABLED")
      .orderBy("Clicks DESC")
      .forDateRange("ALL_TIME")
      .get();           
}

function reportMail(mail_subject, mail_body, attachment) {    
  
  var options = { attachments: [Utilities.newBlob(attachment, 'text/csv', FILE_NAME)] };                 
  for(var i in TO) {
    MailApp.sendEmail(TO[i], mail_subject, mail_body, options);     
  }  
}

function _formatResults(entity,SEP) {
  var e = entity.e;
  var sep = (SEP)? SEP:",";    
    
  return [
          (new Date()).getTime(),
          e.getCampaign().getId(),
          e.getCampaign().getName(),
          e.getId(),
          e.getLinkText(),   
          entity.code,
          e.urls().getFinalUrl()    
         ].join(sep)+"\n";  
}
  
function _getDateString() {

  return Utilities.formatDate((new Date()), AdWordsApp.currentAccount().getTimeZone(), "ddMMyyyy_hhmmss");
}

function SHelper() {
  
  this.ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  this.sh = this.ss.getSheetByName(SHEET_NAME);
  this.header = SHEET_HEADER;

  this.flush = function() {
    //ejecuta los cambios pendientes de la spreadsheet
    SpreadsheetApp.flush();
  }

  this.readAllData = function() {
    //todas las filas y columnas con valor
    var values = this.sh.getDataRange().getValues(); 
    values.shift(); //get rid of headers
    var data = [];  

    for (var i=0; i<values.length; i++) {
      var row = "";
      for (var j=0; j<values[i].length; j++) {
        if (values[i][j]) {
          row = row + values[i][j];
        }
        row = row + ",";
      }         
      data[i] = row.slice(0, -1);   
    }
    return data;
  }

  this.readColumnData = function(columnName) {
    
    var index = this.header.indexOf(columnName);
    var values = this.sh.getRange(1, index+1, this.sh.getLastRow()).getValues();
    values.shift(); //get rid of headers
    var data = [];  

    for (var i=0; i<values.length; i++) {
      var row = "";
      for (var j=0; j<values[i].length; j++) {
        if (values[i][j]) {
          row = row + values[i][j];
        }
        row = row + ",";
      }         
      data[i] = row.slice(0, -1);   
    }
    return data;
  }

  this.clearData = function() {
    //Clear spreadsheet content while preserving any formatting
    this.sh.clearContents();
  }

  this.appendRow = function(row) {
    // Appends a new row to the bottom of the spreadsheet 
    if(row) this.sh.appendRow(row);
  }

  this.readRow = function(index) {
    //get row by its index
    var r=[];
    if(index > 0 && this.sh.getLastRow() > 0) {
      var values = this.sh.getRange(index, 1, 1, this.sh.getLastColumn()).getValues();      
        for (var i=0; i<values[0].length; i++) {
          r[i] = values[0][i];
        }          
    }
    return r;
  }

  this.size = function() {
    return this.sh.getLastRow();
  }
}



