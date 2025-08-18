const axios = require('axios');
const FCMService = require('./fcmService'); // Adjust path if needed
const db = require('./firebaseAdmin..js');
db.collection('clients')

// contacts: array of objects with an "email" property
async function getFcmTokensForMailingList(contacts) {
  const emails = contacts.map(contact => contact.email).filter(Boolean);
  if (emails.length === 0) return [];

  // Find users whose email is in the mailing list
  let foundUsers = [];
  if (emails.length > 0) {
    const usersSnap = await db.collection('users').where('email', 'in', emails).get();
    foundUsers = usersSnap.docs.map(doc => doc.data());
  }

  return foundUsers.map(user => user.fcmToken);
}

class QualtricsService {
  constructor(apiKey, dataCenter) {
    this.apiKey = apiKey;
    this.dataCenter = dataCenter;
    this.api = axios.create({
      baseURL: `https://${dataCenter}.qualtrics.com/API/v3`,
      headers: {
        'X-API-TOKEN': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async getSurveys() {
    try {
      const response = await this.api.get('/surveys');
      // The surveys are in response.data.result.elements
      return response.data.result.elements;
    } catch (error) {
      console.error('Error fetching surveys:', error.message);
      return [];
    }
  }

  async getDistributions(surveyId) {
    try {
      const response = await this.api.get(`/distributions?surveyId=${surveyId}`);
      // The distributions are in response.data.result.elements
      return response.data.result.elements || [];
    } catch (error) {
      console.error('Error fetching distributions:', error.message);
      return [];
    }
  }

  // clientId is the MongoDB _id of the client
  async getSurveyList(clientId) {
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) throw new Error('Client not found');
    const client = { id: clientSnap.id, ...clientSnap.data() };

    const apiKey = client.qualtricsApiKey;
    const datacenter = client.qualtricsDatacenter;

    const url = `https://${datacenter}.qualtrics.com/API/v3/surveys`;
    const headers = {
      'X-API-TOKEN': apiKey,
    };

    const response = await axios.get(url, { headers });
    return response.data;
  }

  // New method: Update client's activeSurveys with last distribution times
  async updateClientActiveSurveys(clientId) {
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) throw new Error('Client not found');
    const client = { id: clientSnap.id, ...clientSnap.data() };

    const apiKey = client.qualtricsApiKey;
    const datacenter = client.qualtricsDatacenter;
    const api = axios.create({
      baseURL: `https://${datacenter}.qualtrics.com/API/v3`,
      headers: {
        'X-API-TOKEN': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const surveysRes = await api.get('/surveys');
    const surveys = surveysRes.data.result.elements;

    const activeSurveys = [];
    for (const survey of surveys) {
      let lastDistribution = null;
      try {
        const distsRes = await api.get(`/distributions?surveyId=${survey.id}`);
        const distributions = distsRes.data.result.elements || [];
        if (distributions.length > 0) {
          distributions.sort((a, b) => new Date(b.sentDate) - new Date(a.sentDate));
          lastDistribution = distributions[0];
        }
      } catch (err) {
        lastDistribution = null;
      }

      // Find previous survey in activeSurveys
      const prevSurvey = client.activeSurveys.find(s => s.surveyId === survey.id);
      const prevDistributionId = prevSurvey?.lastDistribution?.id;

      // If new distribution detected, fetch mailing list and send push
      if (lastDistribution && lastDistribution.id !== prevDistributionId) {
        // Only proceed if the distribution has a mailingListId
        if (lastDistribution.recipients && lastDistribution.recipients.mailingListId) {
          try {
            const mailingList = await this.getMailingListForDistribution(client, lastDistribution.id);
            const fcmTokens = await getFcmTokensForMailingList(mailingList.contacts);

            for (const token of fcmTokens) {
              await FCMService.sendPushNotification(
                token,
                'New Survey Distribution',
                `A new survey "${survey.name}" is available!`
              );
            }
            console.log(`Sent push notifications for new distribution ${lastDistribution.id} of survey ${survey.name}`);
          } catch (err) {
            console.error(`Error sending push notifications for distribution ${lastDistribution?.id}:`, err.message);
          }
        } else {
          console.log(`Distribution ${lastDistribution.id} for survey ${survey.name} has no mailingListId, skipping push notifications.`);
        }
      }

      activeSurveys.push({
        surveyId: survey.id,
        name: survey.name,
        lastDistribution: lastDistribution ? {
          id: lastDistribution.id,
          sentDate: lastDistribution.sentDate,
          ...lastDistribution // include other fields if needed
        } : null,
      });
    }

    client.activeSurveys = activeSurveys;
    await db.collection('clients').doc(clientId).update({ activeSurveys });
    return activeSurveys;
  }

  async getMailingListForDistribution(client, distributionId) {
    const apiKey = client.qualtricsApiKey;
    const datacenter = client.qualtricsDatacenter;
    const directoryId = client.directoryId;
    const api = axios.create({
      baseURL: `https://${datacenter}.qualtrics.com/API/v3`,
      headers: {
        'X-API-TOKEN': apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Fetch distribution details to get the mailingListId
    const distRes = await api.get(`/distributions/${distributionId}`);
    const mailingListId = distRes.data.result.mailingListId;

    if (!mailingListId || !directoryId) {
      throw new Error('Missing mailingListId or directoryId for this distribution.');
    }

    // Fetch all contacts with pagination
    let contacts = [];
    let nextPage = null;
    do {
      const url = nextPage 
        ? `/directories/${directoryId}/mailinglists/${mailingListId}/contacts?page=${nextPage}`
        : `/directories/${directoryId}/mailinglists/${mailingListId}/contacts`;
      const contactsRes = await api.get(url);
      contacts = contacts.concat(contactsRes.data.result.elements || []);
      nextPage = contactsRes.data.result.nextPage;
    } while (nextPage);

    // Extract emails
    const emails = contacts.map(c => c.email);

    // Check which emails exist in your users collection
    let foundUsers = [];
    if (emails.length > 0) {
      const usersSnap = await db.collection('users').where('email', 'in', emails).get();
      foundUsers = usersSnap.docs.map(doc => doc.data());
    }

    // Return a mapping of email to user existence
    const emailStatus = emails.map(email => ({
      email,
      userExists: foundUsers.some(u => u.email === email)
    }));

    return {
      mailingListId,
      contacts: emailStatus
    };
  }
}

module.exports = { QualtricsService };