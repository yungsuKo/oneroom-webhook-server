var axios = require('axios');
require('dotenv').config();

const zendeskDomain = process.env.ZENDESK_DOMAIN;
const zendeskEmail = process.env.ZENDESK_EMAIL;
const zendeskToken = process.env.ZENDESK_API_TOKEN;

const authHeader =
  'Basic ' +
  Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString('base64');

async function fetchAllUsers() {
  let url = `https://${zendeskDomain}/api/v2/users.json?role=end-user`;
  const users = [];

  try {
    while (url) {
      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
      });

      users.push(...response.data.users); // 전개 연산자로 개별 추가
      console.log(`Fetched ${response.data.users.length} users from ${url}`);

      url = response.data.next_page || null;
    }

    console.log(`✅ Total users fetched: ${users.length}`);
    return users;
  } catch (error) {
    console.error(
      '❌ Error fetching users:',
      error.response?.data || error.message
    );
    return [];
  }
}

fetchAllUsers().then((users) => {
  console.log('Final Result Sample:', users.slice(0, 3)); // 샘플 출력
});
