const deleteProduct = (btn) => {
  // get the CSRF token and the productID to make an asynchronous request to the server
  // the parentNode of the button is the div with the class "card_actions"
  const prodId = btn.parentNode.querySelector("[name=productId]").value;
  const csrf = btn.parentNode.querySelector("[name=_csrf]").value;

  // closest provides the closest ancestor element with the selector passed in
  const productElement = btn.closest("article");

  // fetch is a method supported by the browser for sending http requests
  // Its not only used for fetching data, also used to send data
  // without specifying the full URL, it will send to the current host
  // second arg is an object that we can configure the fetch request
  // fetch returns a promise to handle the response
  // for this request, we are not sending any JSON data because delete requests do not have a body
  // if we were sending a POST request with a body, we would have to parse the JSON data on the server
  fetch("/admin/product/" + prodId, {
    method: "DELETE",
    // The csurf package we are using on the server does not just look at the request body for the
    // csrf token, it also looks at the query parameters and headers
    headers: {
      "csrf-token": csrf,
    },
  })
    .then((result) => {
      // result.json() returns a new promise
      // this is how we get the json data from the response
      return result.json();
    })
    .then((data) => {
      console.log(data);
      productElement.parentNode.removeChild(productElement);
    })
    .catch((err) => {
      console.log(err);
    });
};
