/**********************************************************
 * El siguiente script vigila los adgroups seleccionados.
 * Para cada uno de sus anuncios mira si estan teniendo impresiones (activos)
 * actualmente y si se produjeron clicks anteriormente.
 * (solo adgroups/campañas activos)
 ***********************************************************/


var MAX_CHECKS=500; //800 default
var READ_ONLY=false; 
var TO = ['carlosr@semmantica.com']; //you can add more, separate with commas
var SUBJECT = "AdGroup performance alert"; //email's subject
var FIELD_SEPARATOR=",";
var FILE_NAME = "agroup-performance-alert";



function main() {

	var entities = [];
	var adg_counter =0;
	var ad_counter = 0;
	
	var adgIter = AdWordsApp.adGroups()
		.withCondition("Impressions = 0")
		.withCondition("Status = ENABLED")
		.withCondition("CampaignStatus = ENABLED")
		.forDateRange("YESTERDAY")
		.withLimit(MAX_CHECKS)
		.get();


	Logger.log("adgroups encontrados: "+adgIter.totalNumEntities());


	while(adgIter.hasNext()) {
		var adg = adgIter.next();

		//ninguno de los anuncios del grupo actual deberia estar activo
		if( adg.ads().withCondition("Status = ENABLED").get().hasNext() )
			continue;

		var adIter = adg.ads()
			.withCondition("Clicks > 0")			
			.forDateRange("LAST_7_DAYS")
			.get();

		if(adIter.totalNumEntities() > 0)
			adg_counter++;		 
				
		while(adIter.hasNext()) {			
			var ad = adIter.next();
			entities.push(ad);
			ad_counter++;

			Logger.log(ad.getCampaign()+" "+ad.getAdGroup()+" "
				+ad.getHeadline()+" "+ad.getId()+" "+ad.isEnabled());
		}
	}

	//construye el cuerpo y el asunto del email	
	var mail_body = "Hay " + adg_counter + " grupos de anuncios cuyo rendimiento ha caido"+
		" despues de parar todos sus anuncios.\nUn total de "+ad_counter+" anuncios han sido revisados." ;
          
	reportMail(entities, SUBJECT, mail_body);	

    Logger.log("\n\n*** Fin del script***\n\n" + mail_body);
}



function reportMail(entities, mail_subject, mail_body) {
	
  var column_names = ['Type','Enabled','CampaignName','AdGroupName',
  'Text','CampaignID','AdGroupID','AdID','URL'];

  var attachment = column_names.join(",")+"\n";
  for(var i in entities) {
    attachment += _formatResults(entities[i], FIELD_SEPARATOR);
  }

  if(entities.length > 0) {
    var options = { attachments: [Utilities.newBlob(
    	attachment, 'text/csv', FILE_NAME+'_'+_getDateString()+'.csv')] };	               
    for(var i in TO) 
      MailApp.sendEmail(TO[i], mail_subject, mail_body, options);	    
	} 
}


function _isEnabled(e) {

	//para ads y keywords
	if(e.getEntityType() == "Ad" || e.getEntityType() == "Keyword") {
		return (e.isEnabled() && e.getAdGroup().isEnabled() 
	    	&& e.getCampaign().isEnabled())  
	}
	return undefined;
}

function _getDateString() {

  return Utilities.formatDate((new Date()), AdWordsApp.currentAccount().getTimeZone(), "ddMMyyyy_hhmmss");
}

function _formatResults(entity,SEP) {
  var e = entity;  
  var sep = (SEP)? SEP:",";
  var enabled = _isEnabled(e) ? "Yes":"No";

  if(e && e.getEntityType() == "Ad" ) {
    //if this is an ad entity
    return ["Ad",
            enabled,
            e.getCampaign().getName(),
            e.getAdGroup().getName(),
            e.getHeadline(),
            e.getCampaign().getId(),
            e.getAdGroup().getId(),
            e.getId(),                        
            e.urls().getFinalUrl(),
           ].join(sep)+"\n";
  } else {
    // and if this is a keyword
    return ["Keyword",
            enabled,
            e.getCampaign().getName(),
            e.getAdGroup().getName(),
            e.getText(),
            e.getCampaign().getId(),
            e.getAdGroup().getId(),
            e.getId(),                                    
            e.urls().getFinalUrl()
           ].join(sep)+"\n";
  }
}