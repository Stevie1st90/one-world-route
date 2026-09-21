(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  let countries=[];

  async function loadCountries(){
    if(countries.length)return countries;
    try{
      countries=await fetch('./data/country-centroids.json',{cache:'force-cache'}).then(r=>r.ok?r.json():Promise.reject(new Error('Country data '+r.status)));
    }catch{
      countries=[];
    }
    return countries;
  }

  async function open(deps){
    const {
      locale,
      supportedLocales,
      loadProfile,
      ensureDialog,
      t,
      esc,
      onSave,
      onClear
    }=deps;
    const $=(s,r=document)=>r.querySelector(s);
    const countryData=await loadCountries();
    const profile=loadProfile();
    const modal=ensureDialog('platformTravellerModal');
    const display=(()=>{try{return new Intl.DisplayNames([locale],{type:'region'})}catch{return null}})();
    const options=[...countryData]
      .filter(c=>c.cca2)
      .map(c=>({code:c.cca2,name:display?.of(c.cca2)||c.name}))
      .sort((a,b)=>a.name.localeCompare(b.name,locale));
    const countryOptions=(selected,blank=true)=>`${blank?`<option value="">${esc(t('notSet'))}</option>`:''}${options.map(o=>`<option value="${esc(o.code)}" ${selected===o.code?'selected':''}>${esc(o.name)}</option>`).join('')}`;
    const currencies=typeof Intl.supportedValuesOf==='function'
      ?Intl.supportedValuesOf('currency')
      :['EUR','USD','GBP','CHF','JPY','CAD','AUD','NZD','CNY','INR','BRL','MXN','ZAR','SGD'];

    modal.innerHTML=`<form id="platformTravellerForm" class="platform-modal-card traveller-card glass"><button class="platform-x" type="button" aria-label="${esc(t('close'))}">×</button><div class="platform-eyebrow">${esc(t('global'))}</div><h2>${esc(t('contextTitle'))}</h2><p class="platform-lead">${esc(t('contextLead'))}</p><div class="traveller-grid"><label>${esc(t('passports'))}<select name="passport">${countryOptions(profile.passports?.[0]||null)}</select></label><label>${esc(t('secondPassport'))}<select name="passport2">${countryOptions(profile.passports?.[1]||null)}</select></label><label>${esc(t('residence'))}<select name="residence">${countryOptions(profile.residenceCountry)}</select></label><label>${esc(t('language'))}<select name="language">${supportedLocales.map(l=>`<option value="${esc(l)}" ${profile.language===l?'selected':''}>${esc(l.toUpperCase())}</option>`).join('')}</select></label><label>${esc(t('currency'))}<select name="currency">${currencies.map(c=>`<option value="${esc(c)}" ${profile.currency===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label class="span-2">${esc(t('origin'))}<input name="origin" value="${esc(profile.origin||'')}" autocomplete="off" placeholder="e.g. Toronto / YYZ"></label><label>${esc(t('adults'))}<input name="adults" type="number" min="1" max="20" value="${Number(profile.party?.adults||1)}"></label><label>${esc(t('children'))}<input name="children" type="number" min="0" max="20" value="${Number(profile.party?.children||0)}"></label><label class="check span-2"><input name="mobility" type="checkbox" ${profile.accessibility?.reducedMobility?'checked':''}><span>${esc(t('mobility'))}</span></label><div class="traveller-subhead span-2">${esc(t('vehicleSection'))}</div><label>${esc(t('vehicleType'))}<select name="vehicleType"><option value="">${esc(t('notSet'))}</option><option value="private-car" ${profile.vehicle?.type==='private-car'?'selected':''}>${esc(t('privateCar'))}</option><option value="rental-car" ${profile.vehicle?.type==='rental-car'?'selected':''}>${esc(t('rentalCar'))}</option><option value="camper" ${profile.vehicle?.type==='camper'?'selected':''}>${esc(t('camper'))}</option><option value="motorcycle" ${profile.vehicle?.type==='motorcycle'?'selected':''}>${esc(t('motorcycle'))}</option><option value="other" ${profile.vehicle?.type==='other'?'selected':''}>${esc(t('otherVehicle'))}</option></select></label><label>${esc(t('registrationCountry'))}<select name="vehicleRegistration">${countryOptions(profile.vehicle?.registrationCountry||null)}</select></label><label>${esc(t('fuelType'))}<select name="vehicleFuel"><option value="unknown">${esc(t('unknown'))}</option><option value="petrol" ${profile.vehicle?.fuelType==='petrol'?'selected':''}>${esc(t('petrol'))}</option><option value="diesel" ${profile.vehicle?.fuelType==='diesel'?'selected':''}>${esc(t('diesel'))}</option><option value="hybrid" ${profile.vehicle?.fuelType==='hybrid'?'selected':''}>${esc(t('hybrid'))}</option><option value="plug-in-hybrid" ${profile.vehicle?.fuelType==='plug-in-hybrid'?'selected':''}>${esc(t('pluginHybrid'))}</option><option value="electric" ${profile.vehicle?.fuelType==='electric'?'selected':''}>${esc(t('electric'))}</option><option value="hydrogen" ${profile.vehicle?.fuelType==='hydrogen'?'selected':''}>${esc(t('hydrogen'))}</option><option value="other" ${profile.vehicle?.fuelType==='other'?'selected':''}>${esc(t('otherVehicle'))}</option></select></label><label>${esc(t('euroClass'))}<select name="vehicleEuro"><option value="unknown">${esc(t('unknown'))}</option>${['Euro 1','Euro 2','Euro 3','Euro 4','Euro 5','Euro 6'].map(v=>`<option value="${esc(v)}" ${profile.vehicle?.euroClass===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label class="check span-2"><input name="rentalCrossBorder" type="checkbox" ${profile.vehicle?.rentalCrossBorderApproved===true?'checked':''}><span>${esc(t('rentalCrossBorder'))}</span></label></div><p class="platform-privacy">${esc(t('private'))}</p><div class="platform-form-actions"><button class="ghost" type="button" id="platformClearTraveller">${esc(t('clear'))}</button><button class="primary" type="submit">${esc(t('save'))}</button></div></form>`;
    modal.classList.remove('hidden');
    $('.platform-x',modal).onclick=()=>modal.classList.add('hidden');
    $('#platformClearTraveller',modal).onclick=()=>{
      modal.classList.add('hidden');
      onClear();
    };
    $('#platformTravellerForm',modal).onsubmit=e=>{
      e.preventDefault();
      const f=new FormData(e.currentTarget);
      const passports=[f.get('passport'),f.get('passport2')]
        .filter(Boolean)
        .map(String)
        .filter((v,i,a)=>a.indexOf(v)===i);
      const vehicleType=String(f.get('vehicleType')||'');
      const vehicle=vehicleType?{
        type:vehicleType,
        registrationCountry:f.get('vehicleRegistration')||null,
        fuelType:String(f.get('vehicleFuel')||'unknown'),
        euroClass:String(f.get('vehicleEuro')||'unknown'),
        rentalCrossBorderApproved:vehicleType==='rental-car'?(f.get('rentalCrossBorder')==='on'):null
      }:null;
      const next={
        passports,
        residenceCountry:f.get('residence')||null,
        language:String(f.get('language')||'en'),
        currency:String(f.get('currency')||'EUR'),
        origin:String(f.get('origin')||'').trim()||null,
        party:{adults:Number(f.get('adults')||1),children:Number(f.get('children')||0)},
        accessibility:{reducedMobility:f.get('mobility')==='on'},
        vehicle
      };
      modal.classList.add('hidden');
      onSave(next);
    };
    return modal;
  }

  root.travellerUi={open};
})();
