const crypto = require('crypto');
const axios = require('axios');

const timestamp = Date.now() / 1000;
const coinBaseUrl = 'https://api.pro.coinbase.com';
const krakBaseUrl = 'https://api.kraken.com/0'
const bittrexUrl = 'https://api.bittrex.com/v3';
const krakFee = 0.22;
const coinFee = 0.30;
const bittrexFee = 0.25;
const funds = 300;

class CoinData {
    constructor(price, exchange, fee) {
        this.price = price;
        this.exchange = exchange;
        this.fee = fee;
    }
};
const getCoinMessageSignature = (path, method, body, secret, timestamp) => {
    const what = timestamp + method + path + body;
    const key = Buffer(secret, 'base64');
    const hmac = crypto.createHmac('sha256', key);
    const hmac_digest = hmac.update(what).digest('base64');
    
    return hmac_digest; 
};

const getKrakenMessageSignature = (path, request, secret, nonce) => {
	const message       = qs.stringify(request);
	const secret_buffer = new Buffer(secret, 'base64');
	const hash          = new crypto.createHash('sha256');
	const hmac          = new crypto.createHmac('sha512', secret_buffer);
	const hash_digest   = hash.update(nonce + message).digest('binary');
	const hmac_digest   = hmac.update(path + hash_digest, 'binary').digest('base64');

	return hmac_digest;
};


const getCoinXrpData = () => {
    return axios.get(coinBaseUrl + '/products/xrp-usd/ticker');
};

const getKrakenXrpData = () => {
    return axios.get(krakBaseUrl + '/public/Ticker?pair=XXRPZUSD');
};

const getBittrexXrpData = () => {
    return axios.get(bittrexUrl + '//markets/XRP-USD/ticker');
}

const buy = (price, funds, fee) => {
    const feeAmount = (price / 100) * fee;
    const total = (funds - feeAmount) / price;
    return total;
}

const sell = (price, fee, amount) => {
    const dollarAmount = price < 1 ? (amount * price) : (amount / price);
    const feeAmount = (dollarAmount / 100) * fee;
    return dollarAmount - feeAmount;
}

const arbitrage = (funds, buyPrice, sellPrice, buyFee, sellFee) => {
    const xrp = buy(buyPrice, funds, buyFee);
    const soldAmount = sell(sellPrice, sellFee, xrp);
    const profit = soldAmount - funds;
    return profit;
}

const compareXrpPrice = () => {
    axios.all([getCoinXrpData(), getKrakenXrpData(), getBittrexXrpData()])
        .then(axios.spread(function (coin, krak, rex) {
            const coinData = coin.data;
            const krakData = krak.data.result.XXRPZUSD;
            const rexData = rex.data;
            
            const coinClose = coinData.ask; 
            const krakClose = krakData.a[0];
            const rexClose = rexData.askRate;
            const prices = [new CoinData(coinClose, "Coinbase", coinFee), 
                            new CoinData(krakClose, "Kraken", krakFee), 
                            new CoinData(rexClose, "Bittrex", bittrexFee)];
            // Find the highest and lowest price between exchanges                
            const sorted = prices.sort((a, b) => {
                console.log((a.price * 100000) + " : " + (b.price * 100000));
                console.log(" = " + (a.price * 100000) <= (b.price * 100000));
                return (a.price * 100000) <= (b.price * 100000);
            });
            
            console.log("Coinbase close: " + coinClose);
            console.log("Kraken close: " + krakClose);
            console.log("Bittrex Close: " + rexClose);
            console.log(sorted);
            const lowest = sorted[0];
            const highest = sorted[prices.length-1];
            console.log("Best price difference: " + Math.abs(highest.price - lowest.price));

            console.log("Buy on " + lowest.exchange + " sell on " + highest.exchange);
            for (let i = 10; i <= 500; i += 10) {
                profit = arbitrage(i, lowest.price, highest.price, lowest.fee, highest.fee);
                console.log("Total profit for investment of $" + i + ": " + profit);
            }
        }))
        .catch(function (error) {
            console.log(error);
        });
}

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
async function main() {
    while (true) { 
        compareXrpPrice();
        await sleep(2000);
    }
};

main();