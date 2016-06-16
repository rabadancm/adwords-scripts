/*
 * Crea un informe con los ads que tienen cierta etiqueta 
 * y lo exporta a una hoja de calculo externa
 */
function main() {	
  
  var CLIENT = '';
  var LABEL_NAME = 'Revisar URL';
  var FILE_NAME = 'label-report-' + CLIENT + '_' + _getDateString();
  var MAIL_TO = ['carlosr@semmantica.com'];

	/* FILTER ENTITIES BY LABEL ID */
	var label = AdWordsApp.labels()
	  .withCondition("Name = '"+LABEL_NAME+"'").get().next();

	/* Adwords Query Language (AWQL) */
  	var query = 'SELECT CampaignName,AdGroupName,Headline,CampaignId,AdGroupId,Id,AdType,Status '+
      'from AD_PERFORMANCE_REPORT '+
      'where LabelIds CONTAINS_ANY [' + label.getId() + '] AND CampaignName DOES_NOT_CONTAIN "ZZ_" '+
      'during LAST_7_DAYS';

  //crea un nuevo sheet con los datos del informe y la fecha actual
	var report = AdWordsApp.report(query);
	var ss = SpreadsheetApp.create(FILE_NAME);
	report.exportToSheet(ss.getActiveSheet());

  //da permisos de edicion a los remitentes del correo
  if(MAIL_TO && MAIL_TO.length) {
    ss.addEditors(MAIL_TO);
  }


  //obtiene la url de la sheet y la envia por correo
  var r_url = ss.getUrl();
  var last_row = ss.getLastRow() - 1;
  _sendMail(
    MAIL_TO,
    'Label report URLs - '+CLIENT+' - '+_getDateString(),
    'Informe de URLs etiquetadas como "' +LABEL_NAME+ '" para la cuenta '+CLIENT+
    '\nSe han encontrado un total de '+last_row+' URLs para revisar'+
    '\n\nPara más información consultar el siguiente documento:'+
    '\n' + r_url);


  //logs
  Logger.log('--> DOCUMENTO CREADO CORRECTAMENTE');
  Logger.log('Número de urls encontradas: '+last_row);
  Logger.log('URL del spreadsheet:\n  '+r_url);
  Logger.log('Informe enviado a los siguientes correos:');
  for(var i=0;i<MAIL_TO.length;i++)
    Logger.log('  '+MAIL_TO[i]);

}




function _sendMail(mail_to,mail_subject, mail_body) {                      
  for(var i in mail_to) {
    MailApp.sendEmail(mail_to[i], mail_subject, mail_body);     
  }  
}

function _getDateString() {
  return Utilities.formatDate((new Date()), 
  	AdWordsApp.currentAccount().getTimeZone(), "ddMMyyyy_hhmmss");
}