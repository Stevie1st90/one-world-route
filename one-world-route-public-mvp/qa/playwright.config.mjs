import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'**/*.spec.mjs',timeout:45000,expect:{timeout:8000},fullyParallel:false,
  use:{ignoreHTTPSErrors:process.env.OWR_QA_PROXY_TLS==='1',launchOptions:process.env.OWR_CHROMIUM_PATH?{executablePath:process.env.OWR_CHROMIUM_PATH,proxy:process.env.OWR_QA_PROXY?{server:process.env.OWR_QA_PROXY,bypass:'127.0.0.1,localhost'}:undefined,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.env.OWR_QA_PROXY_TLS==='1'?['--ignore-certificate-errors']:[])]}:undefined,baseURL:process.env.BASE_URL||'https://one-world-route.vercel.app',trace:'retain-on-failure',screenshot:'only-on-failure',video:process.env.OWR_QA_NO_VIDEO==='1'?'off':'retain-on-failure'},
  projects:[
    ...[1440,1920].map(width=>({name:`desktop-${width}`,use:{viewport:{width,height:1000}}})),
    ...[360,390,430].map(width=>({name:`mobile-${width}`,use:{...devices['Pixel 7'],viewport:{width,height:915}}}))
  ]
});