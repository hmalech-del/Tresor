/* Wortvorrat für Chiffren, Anagramme und Morse.
 * Bewusst ohne Umlaute und ohne ß - das hält Verschiebechiffre und
 * Morsecode eindeutig und die Eingabe unmissverständlich. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  T.woerter = ('anker,ampel,apfel,arbeit,atlas,bahnhof,balken,banane,becher,berge,besen,birne,blume,boden,bohne,' +
    'brille,brotkorb,bruecke,buchstabe,buendel,dampfer,decke,diamant,dichter,donner,drache,eimer,eisberg,elefant,' +
    'engel,ernte,fabrik,faden,fahne,falter,farbe,feder,fenster,ferien,feuer,fichte,fiedel,figur,fisch,flasche,' +
    'flocke,floss,fluss,foerster,forelle,frosch,fuchs,garten,gabel,gebirge,gedanke,gerste,gestalt,gewitter,gipfel,' +
    'gitter,glocke,granit,gurke,hafen,hammer,handel,harfe,hasel,hebel,heimat,herbst,hirsch,hobel,honig,huegel,' +
    'insel,jacke,jaeger,kabel,kachel,kaefer,kamera,kamin,kanal,kante,kapitel,karten,kasten,kerze,kessel,kette,' +
    'kiesel,kirsche,kissen,klavier,knoten,kompass,koffer,korken,kranich,kreide,kreis,kuchen,kupfer,laterne,leiter,' +
    'lerche,lichter,linde,loeffel,luchs,magnet,mandel,mantel,marder,markt,mauer,meister,melone,messer,minute,' +
    'mittag,moewe,muschel,muster,nadel,nebel,nelke,nessel,netzwerk,norden,notiz,nuss,olive,orgel,ostern,palme,' +
    'panther,papier,pappel,pfeife,pfeiler,pflaume,pilger,pilze,pinsel,platte,quelle,rabe,rahmen,raster,regal,' +
    'regen,reifen,riegel,rinde,ritter,rolle,rosine,ruder,saeule,salbei,sand,schatten,schere,schiene,schiff,' +
    'schlucht,schnee,schrank,segel,seife,sessel,sichel,silber,sommer,sonne,spange,spatz,spiegel,spinne,stadt,' +
    'stein,stern,stiefel,storch,strand,strom,stufe,sturm,tafel,taler,tanne,taube,teller,teppich,thermik,tinte,' +
    'tisch,traube,treppe,trommel,truhe,tunnel,turm,ufer,uhrwerk,vogel,vulkan,wagen,walnuss,wappen,warte,wasser,' +
    'weiher,wetter,wiese,winter,wolke,wurzel,zange,zapfen,zaun,zeder,zelle,zelt,ziegel,zimmer,zirkel,zitrone,zweig'
  ).split(',');
})(typeof window !== 'undefined' ? window : globalThis);
