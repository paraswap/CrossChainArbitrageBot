const axios = require('axios');

const ParswapURL = 'https://apiv4.paraswap.io/v2';

// https://developers.paraswap.network/
class Paraswap {
  constructor(apiURL = ParswapURL) {
    this.apiURL = apiURL;
    this.referrer = 'arb-bot';
  }

  async getPrice(from, to, srcAmount, network) {
    // TODO: Add error handling
    try {
      const requestURL =
        `${this.apiURL}/prices/?from=${from.address}&to=${to.address}` +
        `&amount=${srcAmount}&fromDecimals=${from.decimals}&toDecimals` +
        `=${to.decimals}&side=SELL&network=${network}`;
      const { data } = await axios.get(requestURL, {
        headers: {
          'X-Partner': this.referrer,
        },
      });
      return {
        price: data.priceRoute.destAmount,
        payload: data.priceRoute,
      };
    } catch (e) {
      throw new Error(
        `Paraswap unable to fetch price ${from} ${to} ${network} ${e.message}`,
      );
    }
  }

  async buildTransaction(
    pricePayload,
    from,
    to,
    srcAmount,
    minDestAmount,
    network,
    userAddress,
  ) {
    try {
      const requestURL = `${this.apiURL}/transactions/${network}?skipChecks=true`;
      const requestData = {
        priceRoute: pricePayload,
        srcToken: from.address,
        destToken: to.address,
        srcAmount: srcAmount,
        destAmount: minDestAmount,
        userAddress: userAddress,
        referrer: this.referrer,
        srcDecimals: from.decimals,
        destDecimals: to.decimals,
      };

      const { data } = await axios.post(requestURL, requestData);
      return data;
    } catch (e) {
      throw new Error(
        `Paraswap unable to buildTransaction ${from} ${to} ${network} ${e.message}`,
      );
    }
  }
}

module.exports = Paraswap;
