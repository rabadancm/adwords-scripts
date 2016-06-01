
/************************************************
* Find and tag broken urls in your account
* Version 1.2
* Created By: Russ Savage
* Upgraded by Carlos Rabadan
* FreeAdWordsScripts.com
************************************************/


var MAX_ADS_CHECKS = 100; //800 default
var MAX_EXEC_TIME = 1740000;//ms MAX=29mins (1740000ms)
var DATE_RANGE = "ALL_TIME";
var READ_ONLY = false; //si es FALSE intentara pausar anuncios/keywords rotas y etiquetarlas
var LABEL_NAME = "Revisar URL";   
var LABEL_COLOR = '#CC0000'; //rojo oscuro
var TO = ['carlosr@semmantica.com']; //you can add more, separate with commas
var SUBJECT = 'Broken Url Report - ' + _getDateString();
var FILE_NAME = 'bad_urls_' + _getDateString() + '.csv';
var FIELD_SEPARATOR = ",";
var HTTP_OPTIONS = {
  muteHttpExceptions:true,
  followRedirects: false
};
/*
* REPORT_LEVEL: ajusta el grado de error a monitorizar
* "verbose": todo
* "redirection": >299
* "error": >399 tambien -1 (url no reconocida)
*/
var REPORT_LEVEL_TIERS = {"none":0 , "verbose":1, "redirection":2, "error":3}
var REPORT_LEVEL = REPORT_LEVEL_TIERS.redirection; 



function main() {
    
  var revised_urls = [];
  var urlMap = {};
  var badUrlMap = {};
  var ent_counter=0;
  var bad_counter=0;
  var rev_counter=0;
  var time1,time0 = new Date().getTime(); //time flag  
  var iters = _getEntities();//filtra los ads/kws que queremos comprobar

  var totalEntities=0;
  for(var i=0;i<iters.length;i++)
    totalEntities += iters[i].totalNumEntities();

  _createLabel(LABEL_NAME, LABEL_COLOR); //crea la label en caso de no existir


  main_loop:
  for(var x in iters) {
    var iter = iters[x];

    entity_loop:
    while(iter.hasNext()) 
    {

      //controla el tiempo transcurrido, si el script tarda mas de 29min paramos
      time1 = new Date().getTime(); 
      if((time1 - time0) > MAX_EXEC_TIME) {
        Logger.log("AVISO: tiempo de ejecución excedido, parando el script. Tiempo total: "+
          (time1-time0)/60000 +"min");  
          break main_loop;      
      }


      var entity = iter.next();
      //si la entidad ya esta etiquetada se la salta
      if(_hasLabel(entity, LABEL_NAME))
        continue entity_loop;

      ent_counter++;
              
      /* 
      * Comprueba tanto la url normal como la mobile; no mira dos veces la misma url
      * Adwords permite hasta un maximo de 20000 llamadas a UrlFetchApp.fetch al dia
      */
      var urls = [entity.urls().getFinalUrl(), entity.urls().getMobileFinalUrl()];
      for (var i=0; i<urls.length; i++) {
        if (urls[i]==null || !urls[i]) 
          continue;                  
                
        var response_code=0;        
        var lastUrl = encodeURI(urls[i]);
        if (lastUrl in urlMap && !(lastUrl in badUrlMap)) 
          continue entity_loop;
                
        if(!(lastUrl in urlMap)) {
          rev_counter++;
          //_logEntity(entity); //log every entity
        }
        
        urlMap[lastUrl] = true;          
        try{                
          response_code = UrlFetchApp.fetch(lastUrl, HTTP_OPTIONS).getResponseCode();
        }catch(e) {
          //Something is wrong here, we should know about it.
          revised_urls.push({e : entity, code : -1});
          badUrlMap[lastUrl] = true;
        }


  
        switch(REPORT_LEVEL) {                       
          case 0: 
          default: break;          
          case 1: 
            revised_urls.push({e : entity, code : response_code});
            break;
          case 2: 
            if(response_code > 299) {
              revised_urls.push({e : entity, code : response_code});
              if(!READ_ONLY) {
                _setLabel(entity, LABEL_NAME); 
                //_pauseEntity(entity,response_code); //pausa el anuncio 
              }     
              badUrlMap[lastUrl] = true;         
              bad_counter++;                
            }
            break;
          case 3: 
            if(response_code > 399) {
              revised_urls.push({e : entity, code : response_code});
              if(!READ_ONLY) {
                _setLabel(entity, LABEL_NAME);
                //_pauseEntity(entity,response_code); //pausa el anuncio 
              }             
              badUrlMap[lastUrl] = true; 
              bad_counter++;  
            }
            break;
        }                        
      }
    }  
  }



  /* Redacta el email y el informe de urls adjunto */  
  if(revised_urls.length > 0) {  
    var column_names = ['Type','Status','CampaignName','AdGroupName',
    'Text','CampaignID','AdGroupID','AdID','ResponseCode','URL'];
    var attachment = column_names.join(",")+"\n";
    for(var i in revised_urls) {
      attachment += _formatResults(revised_urls[i], FIELD_SEPARATOR);
    }
    var body = "Se han encontrado " + bad_counter + " URLs rotas. Ver el informe adjunto para más detalles.";
      body+="\n" +
        "\nNumero maximo de entidades a revisar: "+(MAX_ADS_CHECKS * iters.length) +
        "\nNumero total de entidades encontrados con el filtro seleccionado: "+ totalEntities +
        "\nEntidades revisadas: "+ent_counter +
        "\nURLs unicas: "+rev_counter +
        "\nURLs con error: "+bad_counter;

    reportMail(SUBJECT, body, attachment);
  }
     


  /* SUMMARY LOG */
  Logger.log("\n\n/////////////////////////////////////////////////////////////////////////\n");
  Logger.log("Numero maximo de entidades a revisar: "+ (MAX_ADS_CHECKS * iters.length));
  Logger.log("Numero total de entidades encontrados con el filtro seleccionado: " + totalEntities);
  Logger.log("Entidades revisadas: "+ ent_counter);
  Logger.log("URLs unicas: "+ rev_counter);
  Logger.log("Entidades con error: "+ bad_counter);
  Logger.log("\n/////////////////////////////////////////////////////////////////////////");

}
  


function _getEntities() {
  return iters = [ 
      
    /* ADS */
    AdWordsApp.ads()
      .withCondition("CreativeFinalUrls STARTS_WITH_IGNORE_CASE 'h'")       
      .withCondition("CampaignName DOES_NOT_CONTAIN_IGNORE_CASE 'ZZ_'")
      .withCondition("AdGroupName DOES_NOT_CONTAIN_IGNORE_CASE 'ZZ_'") 
      .withCondition("Status != DISABLED") 
      .withCondition("AdGroupStatus != DELETED") 
      .withCondition("CampaignStatus != DELETED")            
      .orderBy("Clicks DESC")
      .orderBy("Impressions DESC")
      .withLimit(MAX_ADS_CHECKS)
      .forDateRange(DATE_RANGE)              
      //.withCondition("Type = 'TEXT_AD'")
      .get()
      
     
    /* KEYWORDS */
    /*AdWordsApp.keywords()
      .withCondition("Status = 'ENABLED'")
      .withCondition("DestinationUrl != ''")
      .withCondition("AdGroupStatus = 'ENABLED'")
      .withCondition("CampaignStatus = 'ENABLED'")
      .get()*/
    ];
}

function reportMail(mail_subject, mail_body, attachment) {    
  
  var options = { attachments: [Utilities.newBlob(attachment, 'text/csv', FILE_NAME)] };                 
  for(var i in TO) {
    MailApp.sendEmail(TO[i], mail_subject, mail_body, options);     
  }  
}

function _hasLabel(entity,label) {
  var labels = entity.labels()
    .withCondition("Name='" + label + "'")
    .get();
  return labels.hasNext();
}

function _pauseEntity(entity) {
  if(entity && entity.getEntityType() === "Ad" 
    || entity.getEntityType() === "Keyword") {
    entity.pause();
  }
}

function _setLabel(entity,label) {
  if(entity && !_hasLabel(entity,label)) {
    entity.applyLabel(label);
  }
}

function _removeLabel(entity,label) {
  //remove the label from a single ad/kw
  if(entity) {
    entity.removeLabel(label);
  }
}

function _removeAllLabels(label) {
  //removes the label from all ads/kws 
  var labels = AdWordsApp.labels().withCondition(
      "Name='" + label + "'").get();
  if (labels.hasNext()) {
    labels.next().remove();
  }
}

function _createLabel(label, color) { 
  //crea la label si no existe
  var labels = AdWordsApp.labels().withCondition(
      "Name='" + label + "'").get();
  if (!labels.hasNext()) {
    AdWordsApp.createLabel(label,"", color);
  }
}

function _isEnabled(e) {

  //para ads y keywords
  if(e.getEntityType() === "Ad" || e.getEntityType() === "Keyword") {
    return (e.isEnabled() && e.getAdGroup().isEnabled() 
        && e.getCampaign().isEnabled())  
  }
  return undefined;
}

function _formatResults(entity,SEP) {
  var e = entity.e;
  var sep = (SEP)? SEP:",";  
  var enabled = _isEnabled(e) ? "Yes":"No"; 

  if(typeof(e['getHeadline']) != "undefined") {
    //this is an ad entity
    return ["Ad",
            enabled,
            e.getCampaign().getName(),
            e.getAdGroup().getName(),
            e.getHeadline(),
            e.getCampaign().getId(),
            e.getAdGroup().getId(),
            e.getId(),            
            entity.code,
            e.urls().getFinalUrl(),
           ].join(sep)+"\n";
  } else {
    // and this is a keyword
    return ["Keyword",
            enabled,
            e.getCampaign().getName(),
            e.getAdGroup().getName(),
            e.getText(),
            e.getCampaign().getId(),
            e.getAdGroup().getId(),
            e.getId(),                        
            entity.code,
            e.urls().getFinalUrl()
           ].join(sep)+"\n";
  }
}
  
function _getDateString() {

  return Utilities.formatDate((new Date()), AdWordsApp.currentAccount().getTimeZone(), "ddMMyyyy_hhmmss");
}

function _logEntity(entity) {
  //log de cada una de las urls que revisa
  try{
      Logger.log("*******************************************************************************************");
      Logger.log("EntityID: "+entity.getId());
      Logger.log("Text: "+entity.getHeadline());
      Logger.log("Campaign: "+entity.getCampaign());
      Logger.log("AdGroup: "+entity.getAdGroup());
      Logger.log("Enabled: "+entity.isEnabled());   
      Logger.log("Type: "+entity.getType());   
      Logger.log("FinalUrl: "+entity.urls().getFinalUrl());
      Logger.log("DisplayUrl: "+entity.getDisplayUrl());
      Logger.log("*******************************************************************************************\n");
    }catch(err) {}
    return;
}