const axios = require('axios');
let data = '{"criteria":{"distributionTypes":["Buy"],"estateTypes":["House","Apartment"],"projectTypes":["Resale","New_Build","Projected","Life_Annuity"],"location":{"placeIds":["NBH2FR3338"]}},"paging":{"page":1,"size":30,"order":"Default"}}';

let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://www.seloger.com/serp-bff/search',
  headers: { 
    'accept': '*/*', 
    'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', 
    'content-type': 'application/json; charset=utf-8', 
    'origin': 'https://www.seloger.com', 
    'priority': 'u=1, i', 
    'referer': 'https://www.seloger.com/classified-search?distributionTypes=Buy&estateTypes=House,Apartment&locations=eyJwbGFjZUlkIjoiQUQwOEZSMTczMDEiLCJyYWRpdXMiOjEsInBvbHlsaW5lIjoid2hkX0huc2NIYEBiT2ZCcE5kRGZNfEVwS3BHZkl0SHJGbkl0Q35JckB8SXNAbkl1Q3ZIc0ZuR2lJfEVvS2REaU1mQm9OYEBjT2FAYU9nQm9OZURpTX1Fb0tvR2lJd0hzRm9JdUN9SXNAX0pyQG9JdEN1SHJGcUdmSX1FcEtlRGZNZ0JuTmFAYk8iLCJjb29yZGluYXRlcyI6eyJsYXQiOjQ3LjIwNDA5NDc0NzE2NzMwNCwibG5nIjotMS40OTgzMjQ5NTI0OTc3NTI0fX0', 
    'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"', 
    'sec-ch-ua-mobile': '?0', 
    'sec-ch-ua-platform': '"Linux"', 
    'sec-fetch-dest': 'empty', 
    'sec-fetch-mode': 'cors', 
    'sec-fetch-site': 'same-origin', 
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 
    'Cookie': 'g_state={"i_l":0,"i_ll":1763211445365,"i_b":"B3t03fRHr4BamLnLtTV2hPtRePuAcawTaIgHAQRQ07k"}; _dd_s=aid=846cf92c-8531-426e-b6d5-bb865254c74a&logs=0&expire=1763217182899&rum=0'
  },
  data : data
};

axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
