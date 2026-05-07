function escapeHTML(str) {
  return str?.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#39;');
}

// text to display
const success = 'You may now close this window.';
const notFound = 'It may have been deleted.';
const forbidden = 'You are not the approver on record.';
let noLongerPending = 'It is currently "{status}".';
let modified = 'Click {here} to view the up-to-date request in the app.';
let otherFailedString = `<b>Something went wrong and the holiday request was not {approvalResult}.</b><br>Please refresh the page to try again, or contact your system administrator if the problem persists.`;

function getResponseString(response, prefix = '') {
  const code = response?.code;
  const message = escapeHTML(response?.message);
  const ID = response?.ID;
  const status = escapeHTML(response?.status);
  const link = 'icanhazdadjoke.com';
  prefix = prefix ? `${prefix}:<br>` : '';
  switch (code) {
    case 200: return `${prefix}<b>${message}.</b><br>${success}`;
    case 404:
      console.warn(`Request not found (ID: ${ID})`);
      return `${prefix}<b>${message}.</b><br>${notFound}`;
    case 403:
      console.warn(`Insufficient permissions (ID: ${ID})`);
      return `${prefix}<b>${message}.</b><br>${forbidden}`;
    case 409:
      console.warn(`Request not pending (ID: ${ID})`);
      noLongerPending = noLongerPending.replace('{status}', status);
      return `${prefix}<b>${message}.</b><br>${noLongerPending}`;
    case 412:
      console.warn(`Request modified (ID: ${ID})`);
      modified = modified.replace('{here}', `<a href="${link}">here</a>`);
      return `${prefix}<b>${message}.</b><br>${modified}`;
    default:
      console.warn(`Unhandled code ${code}`);
      console.log(response);
      return `${prefix}${otherFailedString}`;
  }
}

window.onload = function() {
  // extract decoded parameters from URL
  const params = new URLSearchParams(window.location.search);
  const flowUrl = params.get('flowUrl');
  const requestType = params.get('requestType');
  const approvalResultRaw = params.get('approvalResult');
  const approvalResultSafe = escapeHTML((approvalResultRaw || '').toLowerCase());
  otherFailedString = otherFailedString.replace('{approvalResult}', approvalResultSafe);
  const requests = JSON.parse(params.get('requests'));

  // do a GET on the URL to trigger the flow and change the text displayed on the site
  fetch(flowUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: requestType, approvalResult: approvalResultRaw, requests: requests })
    }
  )
  .then(response => response.json().then(body => {
    if (response.ok) return body;
    return Promise.reject({ status: response.status, body }); // trigger the catch
  }))
  .then(body => {
    console.log('The request succeeded.');
    const firstResponse = body.responses[0];
    if (body.count === 1) {
      document.getElementById('display-text').innerHTML = getResponseString(firstResponse);
    } else {
      console.log('Multiple requests were handled...');
      const otherResponses = body.responses.slice(1);
      if (otherResponses.every(
        response => response.code === firstResponse.code
      )) {
        console.log('All requests had the same response.');
        document.getElementById('display-text').innerHTML = getResponseString(firstResponse);
        otherResponses.forEach(getResponseString); // to log to the console
      } else {
        console.log('The requests had different responses.');
        const prefixes = ['This Year', 'Next Year'];
        document.getElementById('display-text').innerHTML =
          body.responses.map((response, i) => getResponseString(response, prefixes[i])).join('<br><br>');
      }
    }
  })
  .catch(error => {
    console.error('The request failed. Error info:');
    const stringified = JSON.stringify(error, null, 2);
    console.error(stringified === '{}' ? error: stringified);
    document.getElementById('display-text').innerHTML = otherFailedString
  });
}