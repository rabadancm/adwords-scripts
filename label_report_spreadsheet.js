/*
 * Crea un informe con los ads que tienen cierta etiqueta 
 * y lo exporta a una hoja de calculo externa
 */
function main() {	
  
  var LABEL_NAME = 'Revisar URL';
  var FILE_NAME = 'label-report-MARATHONIA_' + _getDateString();

	/* FILTER ENTITIES BY LABEL ID */
	var label = AdWordsApp.labels()
	  .withCondition("Name = '"+LABEL_NAME+"'").get().next();

	/* Adwords Query Language (AWQL) */
  	var query = 'SELECT CampaignName,AdGroupName,Headline,CampaignId,AdGroupId,Id,AdType,Status '+
      'from AD_PERFORMANCE_REPORT '+
      'where LabelIds CONTAINS_ANY [' + label.getId() + '] AND CampaignName DOES_NOT_CONTAIN "ZZ_" '+
      'during YESTERDAY';

    //crea un nuevo sheet con los datos del informe y la fecha actual
	var report = AdWordsApp.report(query);
	var ss = SpreadsheetApp.create(FILE_NAME);
	report.exportToSheet(ss.getActiveSheet());
}

function _getDateString() {
  return Utilities.formatDate((new Date()), 
  	AdWordsApp.currentAccount().getTimeZone(), "ddMMyyyy_hhmmss");
}