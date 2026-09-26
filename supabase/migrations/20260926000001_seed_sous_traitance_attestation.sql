-- Nouveaux modèles de documents (2026-09-26) : contrat de sous-traitance +
-- attestation de propreté. Additif : deux lignes `contract_templates`. Le PDF
-- générique (lib/pdf/ContractPdf) gère le rendu ; l'attestation utilise
-- kind='attestation' (en-tête « ATTESTATION » + signature à une seule partie).
-- Ils apparaissent automatiquement dans le sélecteur de modèle de la fiche
-- client, prennent un numéro CTR-, s'archivent et alimentent l'onglet Documents.
--
-- CONTENU STANDARD à faire valider par ton juriste. Idempotent.

insert into contract_templates (key, name, kind, category, schema, clauses) values
(
  'contrat_sous_traitance', 'Contrat de sous-traitance', 'contrat', 'sous_traitance',
  jsonb_build_object('sections', jsonb_build_array(
    jsonb_build_object('title','Sous-traitant','fields', jsonb_build_array(
      jsonb_build_object('name','client_nom','label','Raison sociale du sous-traitant','type','text','prefill','client.name','full',true),
      jsonb_build_object('name','contact','label','Représentant / Contact','type','text','prefill','client.contact'),
      jsonb_build_object('name','siret','label','SIRET','type','text','prefill','client.siret'),
      jsonb_build_object('name','tel','label','Téléphone','type','text','prefill','client.phone'),
      jsonb_build_object('name','email','label','Email','type','text','prefill','client.email'),
      jsonb_build_object('name','adresse','label','Adresse','type','text','prefill','client.address','full',true),
      jsonb_build_object('name','assurance_rc','label','Assurance RC Pro (assureur / n° police)','type','text','full',true)
    )),
    jsonb_build_object('title','Prestations sous-traitées','fields', jsonb_build_array(
      jsonb_build_object('name','metier','label','Métier / Domaine','type','select','options', jsonb_build_array('Nettoyage','Déménagement','Débarras','Désinsectisation','Entretien hotte','Rénovation','Autre')),
      jsonb_build_object('name','description','label','Nature des prestations','type','textarea','full',true),
      jsonb_build_object('name','lieu','label','Lieu(x) d''exécution','type','text','full',true)
    )),
    jsonb_build_object('title','Conditions','fields', jsonb_build_array(
      jsonb_build_object('name','date_debut','label','Date de prise d''effet','type','date'),
      jsonb_build_object('name','duree','label','Durée','type','text'),
      jsonb_build_object('name','frequency','label','Fréquence / récurrence','type','select','options', jsonb_build_array('Ponctuel','1 passage / an','2 passages / an','3 passages / an','4 passages / an','Autre')),
      jsonb_build_object('name','tarif','label','Rémunération (€ HT)','type','number'),
      jsonb_build_object('name','reglement','label','Modalités de règlement','type','text'),
      jsonb_build_object('name','conditions','label','Conditions particulières','type','textarea','full',true)
    ))
  )),
  jsonb_build_array(
    jsonb_build_object('title','Objet','body','Le donneur d''ordre confie au sous-traitant, qui l''accepte, l''exécution des prestations décrites ci-dessus, sous la responsabilité et le contrôle du donneur d''ordre.'),
    jsonb_build_object('title','Obligations légales & régularité','body','Le sous-traitant certifie être régulièrement immatriculé, à jour de ses obligations sociales et fiscales, et s''engage à fournir les attestations de vigilance (art. L.8222-1 et D.8222-5 du Code du travail) ainsi que tout justificatif requis, renouvelés tous les six (6) mois.'),
    jsonb_build_object('title','Assurance & responsabilité','body','Le sous-traitant déclare être titulaire d''une assurance responsabilité civile professionnelle couvrant les prestations objet du contrat, et répond des dommages causés dans le cadre de leur exécution.'),
    jsonb_build_object('title','Confidentialité','body','Le sous-traitant s''engage à garder confidentielles toutes les informations, données clients et documents auxquels il a accès dans le cadre du présent contrat, pendant sa durée et après son terme.'),
    jsonb_build_object('title','Non-sollicitation','body','Le sous-traitant s''interdit de démarcher ou de contracter directement avec les clients du donneur d''ordre pour lesquels il intervient, pendant la durée du contrat et douze (12) mois après son terme.'),
    jsonb_build_object('title','Renouvellement','body','Le présent contrat est renouvelable par tacite reconduction pour des périodes équivalentes, sauf dénonciation par l''une des parties.'),
    jsonb_build_object('title','Résiliation','body','La résiliation peut intervenir moyennant un préavis écrit d''un (1) mois par lettre recommandée avec accusé de réception, sans préjudice des prestations en cours.')
  )
),
(
  'attestation_proprete', 'Attestation de propreté', 'attestation', 'proprete',
  jsonb_build_object('sections', jsonb_build_array(
    jsonb_build_object('title','Établissement / Client','fields', jsonb_build_array(
      jsonb_build_object('name','client_nom','label','Nom / Raison sociale','type','text','prefill','client.name','full',true),
      jsonb_build_object('name','adresse','label','Adresse des locaux','type','text','prefill','client.address','full',true),
      jsonb_build_object('name','cp_ville','label','Code postal / Ville','type','text','prefill','client.cpville')
    )),
    jsonb_build_object('title','Prestation réalisée','fields', jsonb_build_array(
      jsonb_build_object('name','type_prestation','label','Type de prestation','type','select','options', jsonb_build_array('Nettoyage courant','Nettoyage de fin de chantier','Nettoyage après sinistre','Remise en état','Désinfection','Autre')),
      jsonb_build_object('name','date_intervention','label','Date d''intervention','type','date'),
      jsonb_build_object('name','surface','label','Surface traitée (m²)','type','number'),
      jsonb_build_object('name','zones','label','Zones / locaux traités','type','textarea','full',true),
      jsonb_build_object('name','intervenant','label','Intervenant(s)','type','text','full',true)
    )),
    jsonb_build_object('title','Constat','fields', jsonb_build_array(
      jsonb_build_object('name','observations','label','Observations','type','textarea','full',true)
    ))
  )),
  jsonb_build_array(
    jsonb_build_object('title','Attestation','body','La société soussignée atteste avoir réalisé, dans les règles de l''art, la prestation de propreté décrite ci-dessus, et certifie le bon état de propreté des locaux à l''issue de l''intervention.'),
    jsonb_build_object('title','Validité','body','La présente attestation est délivrée à la demande de l''intéressé pour servir et valoir ce que de droit.')
  )
)
on conflict (key) do nothing;
