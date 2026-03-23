const axios = require('axios');
let data = JSON.stringify({
  "text": "Savarieres",
  "limit": 10,
  "placeTypes": [
    "NBH1",
    "NBH3",
    "AD09",
    "NBH2",
    "AD08",
    "AD06",
    "AD04",
    "POCO",
    "AD02"
  ],
  "parentTypes": [
    "NBH1",
    "NBH3",
    "AD09",
    "NBH2",
    "AD08",
    "AD06",
    "AD04",
    "POCO",
    "AD02"
  ],
  "locale": "fr"
});

let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://www.seloger.com/search-mfe-bff/autocomplete',
  headers: { 
    'accept': 'application/json, text/plain, */*', 
    'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', 
    'content-type': 'application/json', 
    'origin': 'https://www.seloger.com', 
    'priority': 'u=1, i', 
    'referer': 'https://www.seloger.com/classified-search?distributionTypes=Buy&estateTypes=House,Apartment&locations=NBH2FR3338', 
    'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"', 
    'sec-ch-ua-mobile': '?0', 
    'sec-ch-ua-platform': '"Linux"', 
    'sec-fetch-dest': 'empty', 
    'sec-fetch-mode': 'cors', 
    'sec-fetch-site': 'same-origin', 
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 
    'Cookie': 'g_state={"i_l":0,"i_ll":1763211445365,"i_b":"B3t03fRHr4BamLnLtTV2hPtRePuAcawTaIgHAQRQ07k"}; _dd_s=aid=846cf92c-8531-426e-b6d5-bb865254c74a&logs=0&expire=1763214948941&rum=0'
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
