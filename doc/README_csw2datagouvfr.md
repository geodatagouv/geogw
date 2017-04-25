# Utiliser la passerelle INSPIRE -> DataGouv.fr

Dans le cadre du groupe de travail sur l'interopérabilité entre les normes de l'OGC et la directive INSPIRE de l'AFIGéo ([voir sur le site internet](http://afigeo.asso.fr/pole-entreprise/groupe-dinteret-ogc.html)), une passerelle a été développée entre les flux CSW et le portail Open Data national.

L'objectif est de capitaliser sur le travail de documentation des métadonnées et de référencement des données réalisé par l'écosystème géomatique en permettant aux acteurs de le  valoriser facilement sur le portail de données national.

## Pré-requis

Afin que vos données puissent être accessibles via la passerelle, il faut qu'elles remplissent plusieurs critères :

* avoir le mot-clé `données ouvertes` (voir [étiqueter](/fr/features/documentation/md_classify.html)) ;
* avoir une licence ouverte et indiquer qu'il n'y a aucune limitation au sens INSPIRE (voir [gérer les CGUs](/fr/features/documentation/md_cgu.html#conditions)) ;
* avoir une ressource associée de type WFS (voir [affecter un service WFS](/fr/features/publish/webservices.html#associer-un-flux-wfs)) ;
* être dans un catalogue partagé via CSW (voir [serveur CSW](/fr/features/publish/csw_server.html)).

## Pas à pas

### Compte et organisation sur DataGouv

1. Créer un compte sur DataGouv.fr

    Pour créer un compte ou se connecter : https://www.data.gouv.fr/login. Il est recommandé de créer un compte directement sans l'interface d'un réseau social.

    ![DataGouv - Inscription/connexion](/../img/annex_bridge_INSPIRE_DataGouv_00a.png "Se connecter ou créer un compte sur DataGouv")

2. Créer / rejoindre une organisation sur DataGouv.fr

    Pour cela, il faut passer par l'administration de son profil : https://www.data.gouv.fr/fr/admin/organization/new/. Si elle existe déjà, faites une demande pour la rejoindre.

    ![DataGouv - Organisation](/../img/annex_bridge_INSPIRE_DataGouv_00b_NewOrganization.png "Créer son organisation sur DataGouv")

### Référencement et moissonnage du flux CSW

1. Demander à ce que votre flux CSW soit référencé

    Une fois [votre flux CSW créé dans Isogeo](/fr/features/publish/csw_server.html), il faut écrire à [inspire@data.gouv.fr](mailto:inspire@data.gouv.fr?subject=Ajout d'un service CSW pour diffusion synchronisée sur DataGouv&cc=projets@isogeo.fr) en indiquant votre compte DataGouv.fr, votre / vos organisation(s) et bien sûr le(s) flux concerné(s).

2. Lancer le moissonnage de son catalogue

    Une fois votre flux CSW référencé par l'équipe de DataGouv, il faut lancer le moissonnage. Pour cela, [se rendre sur la page des flux](https://inspire.data.gouv.fr/services/by-protocol/csw) et cliquer sur `Synchroniser`en regard de votre service.

    ![Passerelle INSPIRE - Open Data (1)](/../img/annex_bridge_INSPIRE_DataGouv_1a_syncCSW.png "Page d'accueil de la passerelle")

3. Vérifier le moissonnage

    Une fois la synchronisation terminée (actualiser la page au bout de quelques minutes selon le nombre de métadonnées à moissonner), ouvrir la page détaillée du service. Le nombre de données compatibles est listé par le filtre `Disponibilité = Oui`.

    ![Passerelle INSPIRE - Open Data (1)](/../img/annex_bridge_INSPIRE_DataGouv_1b_serviceDetails.png "Page d'accueil de la passerelle")

    Si une donnée semble ne pas être disponible, revérifier les [prérequis](/fr/appendices/bridge_csw2datagouvfr.html#pr-requis) puis [contacter l'équipe DataGouv](mailto:inspire@data.gouv.fr?subject=Problème de moissonnage d'un CSW (Isogeo)&cc=projets@isogeo.fr).

### Association et publication

1. Aller sur https://inspire.data.gouv.fr/

    ![Passerelle INSPIRE - Open Data (1)](/../img/annex_bridge_INSPIRE_DataGouv_1.png "Page d'accueil de la passerelle")

2. Autoriser la passerelle à utiliser le compte DataGouv

    ![Passerelle INSPIRE - Open Data (2)](/../img/annex_bridge_INSPIRE_DataGouv_2_oauth.png "Lier son compte DataGouv")

3. Choisir l'organisation à configurer

    ![Passerelle INSPIRE - Open Data (3)](/../img/annex_bridge_INSPIRE_DataGouv_3_LinkOrga.png "Choisir parmi ses organisations")

4. Associer le catalogue moissonné

    Dans la liste, choisir le catalogue correspondant au flux que vous avez référencé précédemment.

    ![Passerelle INSPIRE - Open Data (4)](/../img/annex_bridge_INSPIRE_DataGouv_4_PickCatalog.png "Choisir parmi les catalogues sources référencés")

5. Choisir les producteurs à associer à ce catalogue

    Il s'agit de faire correspondre les contacts renseignés dans la métadonnée et le producteur identifié de la donnée. Par exemple, l'administrateur d'une IDG pourra indiquer à quels ayant-droits correspondent quelles données.

    ![Passerelle INSPIRE - Open Data (4)](/../img/annex_bridge_INSPIRE_DataGouv_6_producerMatched.png "Choisir parmi les producteurs à associer")

6. Synchroniser le catalogue pour obtenir les données prêtes à être publiées

    ![Passerelle INSPIRE - Open Data (4)](/../img/annex_bridge_INSPIRE_DataGouv_7b_syncRunning.png "Choisir parmi les producteurs à associer")

7. Gérer la publication des données sur DataGouv

    3 statuts sont possibles :
    * `Données attente de publication`, les nouvelles données recensées qui attendent une action de votre part ;
    * `Données en mode privé`, visibles uniquement par les membres de votre organisation ;
    * `Données publiées`, visibles publiquement sur DataGouv.

    ![Passerelle INSPIRE - Open Data (7)](/../img/annex_bridge_INSPIRE_DataGouv_9_dataPublishedBack.png "Régler le niveau de publication des données sur le portail DataGouv")
