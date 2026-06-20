const core = require('@actions/core');
const { wait } = require('./wait');
const { giteaGetStatuses } = require('./gitea-get-statuses');
const { checkStatuses } = require('./check-statuses');

function formatResponse(statusArray) {
  const mapedStatus = statusArray.map(
    status => `${status.context} = ${status.status}`
  );

  return mapedStatus.join('\n');
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const apiEndpoint = core.getInput('api-endpoint', { required: true });
    const owner = core.getInput('owner', { required: true });
    const repository = core.getInput('repository', { required: true });
    const apiToken = core.getInput('repo-token', { required: true });
    const reference = core.getInput('ref', { required: true });
    const waitInterval = core.getInput('wait-interval', { required: true });

    let allowedConclusions = core.getMultilineInput('allowed-conclusions', {
      required: false
    });
    let workflowNames = core.getMultilineInput('workflow-names', {
      required: false
    });
    let jobNames = core.getMultilineInput('job-names', { required: false });
    let triggerEvents = core.getMultilineInput('trigger-events', {
      required: false
    });

    if (
      !allowedConclusions ||
      allowedConclusions === '' ||
      allowedConclusions.length === 0 ||
      (allowedConclusions.length === 1 && allowedConclusions[0] === '')
    ) {
      allowedConclusions = ['success', 'skipped'];
    } else if (allowedConclusions.includes(',')) {
      allowedConclusions = allowedConclusions.split(',');
    } else if (
      allowedConclusions.length === 1 &&
      allowedConclusions[0].includes(',')
    ) {
      allowedConclusions = allowedConclusions[0].split(',');
    }

    if (
      (workflowNames &&
        workflowNames.length === 1 &&
        workflowNames[0] === '') ||
      workflowNames === '' ||
      (workflowNames && workflowNames.length === 0)
    ) {
      workflowNames = undefined;
    }

    if (
      (jobNames && jobNames.length === 1 && jobNames[0] === '') ||
      jobNames === '' ||
      (jobNames && jobNames.length === 0)
    ) {
      jobNames = undefined;
    }

    if (
      (triggerEvents &&
        triggerEvents.length === 1 &&
        triggerEvents[0] === '') ||
      triggerEvents === '' ||
      (triggerEvents && triggerEvents.length === 0)
    ) {
      triggerEvents = undefined;
    }

    core.debug(`allowedConclusions: ${allowedConclusions}`);
    core.debug(`workflowNames: ${workflowNames}`);
    core.debug(`jobNames: ${jobNames}`);
    core.debug(`triggerEvents: ${triggerEvents}`);

    let waitCondition;
    let failCondition;
    let checkedStatuses;

    do {
      // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
      core.debug(
        `Getting statuses from Gitea API using endpoint: ${apiEndpoint}`
      );
      const data = await giteaGetStatuses(
        apiEndpoint,
        apiToken,
        owner,
        repository,
        reference
      );
      core.debug(`data: ${JSON.stringify(data)}`);
      core.debug('Checking statuses...');
      checkedStatuses = checkStatuses(
        data,
        allowedConclusions,
        workflowNames,
        jobNames,
        triggerEvents
      );
      core.debug(`checkedStatuses: ${JSON.stringify(checkedStatuses)}`);
      core.debug(`allowed: ${formatResponse(checkedStatuses.allowed)}`);
      core.debug(`denied: ${formatResponse(checkedStatuses.denied)}`);
      core.debug(`pending: ${formatResponse(checkedStatuses.pending)}`);

      failCondition = checkedStatuses.denied.length !== 0;
      core.debug(`failCondition: ${failCondition}`);

      waitCondition = !failCondition && checkedStatuses.pending.length > 0;
      core.debug(`waitCondition: ${waitCondition}`);

      if (waitCondition) {
        core.debug(`Waiting ${waitInterval} seconds...`);
        await wait(parseInt(waitInterval, 10) * 1000);
      }
    } while (waitCondition);

    if (failCondition) {
      // Fail the workflow run if an check fail
      core.setFailed(formatResponse(checkedStatuses.denied));
    } else {
      // Set outputs for other workflow steps to use
      core.setOutput('status', formatResponse(checkedStatuses.allowed));
      core.setOutput('raw', checkedStatuses);
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message);
  }
}

module.exports = {
  run
};
