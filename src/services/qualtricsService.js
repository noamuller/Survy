const axios = require('axios');
const FCMService = require('./fcmService'); // Adjust path if needed
const { db } = require('./firebaseAdmin..js');

// contacts: array of objects with an "email" property
// Only return valid FCM tokens for users in our database
async function getFcmTokensForMailingList(contacts) {
  const emails = contacts.map(contact => contact.email).filter(Boolean);
  console.log('getFcmTokensForMailingList: emails from contacts:', emails);
  if (emails.length === 0) return [];

  // Find users whose email is in the mailing list
  let foundUsers = [];
  if (emails.length > 0) {
    const usersSnap = await db.collection('users').where('email', 'in', emails).get();
    foundUsers = usersSnap.docs.map(doc => doc.data());
    console.log('getFcmTokensForMailingList: found users:', foundUsers);
  }

  // Only return valid FCM tokens for matched users
  const tokens = foundUsers
    .map(user => user.fcmToken)
    .filter(token => typeof token === 'string' && token.length > 0);
  console.log('getFcmTokensForMailingList: returning tokens:', tokens);
  return tokens;
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
    console.log('DEBUG: Entered updateClientActiveSurveys for clientId:', clientId);
    if (!clientId) {
      console.error('ERROR: updateClientActiveSurveys called with invalid clientId:', clientId);
      return null;
    }
    // Step 1: Fetch client
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) {
      console.error(`Client not found: ${clientId}`);
      return null;
    }
    const client = { id: clientSnap.id, ...clientSnap.data() };
    console.log(`Processing client: ${client.id} (${client.email || 'no email'})`);

    // Step 2: Setup Qualtrics API
    const apiKey = client.qualtricsApiKey;
    const datacenter = client.qualtricsDatacenter;
    if (!apiKey || !datacenter) {
      console.error(`Missing Qualtrics API key or datacenter for client ${client.id}`);
      return null;
    }
    const api = axios.create({
      baseURL: `https://${datacenter}.qualtrics.com/API/v3`,
      headers: {
        'X-API-TOKEN': apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Step 3: Fetch surveys
    let surveys = [];
    try {
      const surveysRes = await api.get('/surveys');
      surveys = surveysRes.data.result.elements;
      console.log(`Surveys for client ${client.id}:`, surveys.map(s => s.name));
    } catch (err) {
      console.error(`Error fetching surveys for client ${client.id}:`, err.message);
      return null;
    }

    const activeSurveys = [];
    for (const survey of surveys) {
      // Step 4: Fetch distributions
      let lastDistribution = null;
      try {
        const distsRes = await api.get(`/distributions?surveyId=${survey.id}`);
        const distributions = distsRes.data.result.elements || [];
        if (distributions.length > 0) {
          distributions.sort((a, b) => new Date(b.sentDate) - new Date(a.sentDate));
          lastDistribution = distributions[0];
          console.log(`Last distribution for survey ${survey.id} (client ${client.id}):`, lastDistribution.id);
        } else {
          console.log(`No distributions found for survey ${survey.id} (client ${client.id})`);
        }
      } catch (err) {
        console.error(`Error fetching distributions for survey ${survey.id} (client ${client.id}):`, err.message);
        lastDistribution = null;
      }

      // Step 5: Compare last distribution
      const prevSurvey = (client.activeSurveys ?? []).find(s => s.surveyId === survey.id);
      const prevDistributionId = prevSurvey?.lastDistribution?.id;
      if (lastDistribution && lastDistribution.id !== prevDistributionId) {
        // Step 6: Fetch mailing list and match emails
        console.log('DEBUG: Checking distribution recipients:', lastDistribution.recipients);
        console.log('DEBUG: Checking mailingListId:', lastDistribution.recipients ? lastDistribution.recipients.mailingListId : undefined);
        if (lastDistribution.recipients && lastDistribution.recipients.mailingListId) {
          console.log('DEBUG: Entered mailing list processing block for distribution', lastDistribution.id);
          console.log('DEBUG: About to call getMailingListForDistribution for distribution', lastDistribution.id);
          let mailingList = null;
          try {
            mailingList = await this.getMailingListForDistribution(client, lastDistribution.id, survey.id);
            console.log('DEBUG: Mailing list fetched for distribution', lastDistribution.id, 'mailingList:', mailingList);
          } catch (mlErr) {
            console.error('DEBUG: Error in getMailingListForDistribution:', mlErr.message);
          }
          if (!mailingList) {
            console.error('DEBUG: getMailingListForDistribution returned null/undefined for distribution', lastDistribution.id);
          }
          if (!mailingList || !mailingList.contacts) {
            console.log('DEBUG: Mailing list or contacts missing for distribution', lastDistribution.id);
          } else {
            console.log('DEBUG: Mailing list contacts:', mailingList.contacts);
            console.log('DEBUG: About to call getFcmTokensForMailingList. mailingList.contacts:', mailingList.contacts);
            let fcmTokensRaw = [];
            try {
              fcmTokensRaw = await getFcmTokensForMailingList(mailingList.contacts);
              console.log('DEBUG: Raw FCM tokens returned:', fcmTokensRaw);
            } catch (fcmErr) {
              console.error('DEBUG: Error in getFcmTokensForMailingList:', fcmErr.message);
            }
            // Only use valid, non-empty string tokens
            const fcmTokens = fcmTokensRaw.filter(t => typeof t === 'string' && t.length > 0);
            console.log(`DEBUG: Matched FCM tokens for distribution ${lastDistribution.id}:`, fcmTokens);
            // Step 7: Send push notifications
            for (const token of fcmTokens) {
              const notificationTitle = 'New Survey Distribution';
              const notificationBody = `A new survey "${survey.name}" is available!`;
              console.log(`DEBUG: About to send push notification to token: ${token}`);
              console.log('DEBUG: Notification payload:', { token, notificationTitle, notificationBody });
              try {
                await FCMService.sendPushNotification(
                  token,
                  notificationTitle,
                  notificationBody
                );
                console.log(`DEBUG: Push sent to token: ${token}`);
              } catch (pushErr) {
                console.error(`Error sending push to token ${token}:`, pushErr.message);
              }
            }
            console.log(`Sent push notifications for new distribution ${lastDistribution.id} of survey ${survey.name}`);
          }
        } else {
          console.log(`Distribution ${lastDistribution.id} for survey ${survey.name} has no mailingListId, skipping push notifications.`);
        }
      }

      // Step 8: Record active survey
      // Prevent undefined values in Firestore update
      activeSurveys.push({
        surveyId: survey.id,
        name: survey.name,
        lastDistribution: lastDistribution ? {
          id: lastDistribution.id,
          sentDate: lastDistribution.sentDate !== undefined ? lastDistribution.sentDate : null,
          ...Object.fromEntries(Object.entries(lastDistribution).filter(([_, v]) => v !== undefined))
        } : null,
      });
    }

    // Step 9: Update client in Firestore
    client.activeSurveys = activeSurveys;
    try {
      await db.collection('clients').doc(clientId).update({ activeSurveys });
      console.log(`Updated activeSurveys for client: ${client.id}`);
    } catch (updateErr) {
      console.error(`Error updating activeSurveys for client ${client.id}:`, updateErr.message);
    }
    return activeSurveys;
  }

  async getMailingListForDistribution(client, distributionId, surveyId) {
  const apiKey = client.qualtricsApiKey;
  const datacenter = client.qualtricsDatacenter;
  const directoryId = client.directoryId ? client.directoryId.toString().trim() : undefined;
    const api = axios.create({
      baseURL: `https://${datacenter}.qualtrics.com/API/v3`,
      headers: {
        'X-API-TOKEN': apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Fetch distribution details to get the mailingListId
    let distRes;
    if (!surveyId) {
      console.error('DEBUG: surveyId must be provided to getMailingListForDistribution');
      throw new Error('surveyId is required');
    }
    try {
      const distUrl = `/distributions/${distributionId}?surveyId=${surveyId}`;
      console.log('DEBUG: Qualtrics API request for distribution details:', distUrl);
      distRes = await api.get(distUrl);
      console.log('DEBUG: Qualtrics API response for distribution details:', JSON.stringify(distRes.data));
    } catch (err) {
      console.error('DEBUG: Error fetching distribution details:', err.response ? JSON.stringify(err.response.data) : err.message);
      throw err;
    }
  // Correct extraction of mailingListId
  const mailingListId = distRes.data.result.recipients ? distRes.data.result.recipients.mailingListId : undefined;

    if (!mailingListId || !directoryId) {
      console.error('DEBUG: Missing mailingListId or directoryId for this distribution.', { mailingListId, directoryId });
      throw new Error('Missing mailingListId or directoryId for this distribution.');
    }

    // Fetch all contacts with pagination
    let contacts = [];
    let nextPage = null;
    do {
      const url = nextPage 
        ? `/directories/${directoryId}/mailinglists/${mailingListId}/contacts?page=${nextPage}`
        : `/directories/${directoryId}/mailinglists/${mailingListId}/contacts`;
      try {
        console.log('DEBUG: Qualtrics API request for contacts:', url);
        const contactsRes = await api.get(url);
        console.log('DEBUG: Qualtrics API response for contacts:', JSON.stringify(contactsRes.data));
        contacts = contacts.concat(contactsRes.data.result.elements || []);
        nextPage = contactsRes.data.result.nextPage;
      } catch (err) {
        console.error('DEBUG: Error fetching contacts:', err.response ? JSON.stringify(err.response.data) : err.message);
        throw err;
      }
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