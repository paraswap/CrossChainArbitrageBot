const axios = require("axios");

const ParswapURL = "https://apiv4.paraswap.io/v2";

// https://developers.paraswap.network/
class Paraswap {
  constructor(apiURL = ParswapURL) {
    this.apiURL = apiURL;
    this.referrer = "arb-bot";
  }

  async getPrice(from, fromDecimals, to, toDecimals, srcAmount, network) {
    // TODO: Add error handling
    const requestURL = `${this.apiURL}/prices/?from=${from}&to=${to}&amount=${srcAmount}$&fromDecimals=${fromDecimals}&toDecimals=${toDecimals}&side=SELL&network=${network}`;
    const { data } = await axios.get(requestURL, {
      headers: {
        "X-Partner": referrer,
      },
    });
    return {
      price: data.priceRoute.destAmount,
      payload: data.priceRoute,
    };
  }

  async buildTransaction(
    pricePayload,
    from,
    fromDecimals,
    to,
    toDecimals,
    srcAmount,
    minDestAmount,
    network,
    userAddress
  ) {
    // TODO: Add error handling
    const requestURL = `${this.apiURL}/transactions/${network}`;
    const requestData = {
      priceRoute: pricePayload,
      srcToken: from,
      destToken: to,
      srcAmount: srcAmount,
      destAmount: minDestAmount,
      userAddress: userAddress,
      referrer: this.referrer,
      srcDecimals: fromDecimals,
      destDecimals: toDecimals,
    };

    const { data } = await axios.post(txURL, requestData);
    return data;
  }
}

module.exports = Paraswap;
