// Ember Template Lint Formatter to Output Reviewdog Diagnostic Format (RDFormat)
// https://github.com/reviewdog/reviewdog/blob/1d8f6d6897dcfa67c33a2ccdc2ea23a8cca96c8c/proto/rdf/reviewdog.proto
const process = require('process');

function convertSeverity(s) {
  if (s === 0) { // off
    return 'INFO';
  } else if (s === 1) {
    return 'WARNING';
  } else if (s === 2) {
    return 'ERROR';
  }
  return 'UNKNOWN_SEVERITY';
}

function utf8length(str) {
  return unescape(encodeURIComponent(str)).length;
}

function positionFromUTF16CodeUnitOffset(offset, text) {
  const lines = text.split('\n');
  let line = 1;
  let column = 0;
  let lengthSoFar = 0;
  for (const sourceLine of lines) {
    if (offset <= lengthSoFar + sourceLine.length) {
      const lineText = sourceLine.slice(0, offset - lengthSoFar);
      // +1 because eslint offset is a bit weird and will append text right
      // after the offset.
      column = utf8length(lineText) + 1;
      break;
    }
    lengthSoFar += sourceLine.length + 1; // +1 for line-break.
    line++;
  }
  return { line, column };
}

function positionFromLineAndUTF16CodeUnitOffsetColumn(line, sourceColumn, sourceLines) {
  let column = 0;
  if (sourceLines.length >= line) {
    const lineText = sourceLines[line - 1].slice(0, sourceColumn);
    column = utf8length(lineText);
  }
  return { line, column };
}

function commonSuffixLength(str1, str2) {
  let i;
  for (i = 0; i < str1.length && i < str2.length; ++i) {
    if (str1[str1.length - (i + 1)] !== str2[str2.length - (i + 1)]) {
      break;
    }
  }
  return i;
}

function buildMinimumSuggestion(result) {
  const { fix, line, source } = result;
  const l = commonSuffixLength(fix.text, source.slice(line, line));
  return {
    range: {
      start: positionFromUTF16CodeUnitOffset(line, source),
      end: positionFromUTF16CodeUnitOffset(line - l, source)
    },
    text: fix.text.slice(0, fix.text.length - l)
  };
}

function formatDiagnostic(diagnostic) {

  const {filePath, source} = diagnostic;
  const sourceLines = source ? source.split('\n') : [];

  let formattedDiagnostic = {
    message: diagnostic.message,
    location: {
      path: filePath,
      range: {
        start: positionFromLineAndUTF16CodeUnitOffsetColumn(diagnostic.line, diagnostic.column, sourceLines),
        end: positionFromLineAndUTF16CodeUnitOffsetColumn(diagnostic.line, diagnostic.column, sourceLines)
      }
    },
    severity: convertSeverity(diagnostic.severity),
    code: {
      value: diagnostic.rule,
      url: `https://github.com/ember-template-lint/ember-template-lint/blob/master/docs/rule/${diagnostic.rule}.md` //(data.rulesMeta[msg.rule] && data.rulesMeta[msg.rule].docs ? data.rulesMeta[msg.rule].docs.url : '')
    },
    original_output: JSON.stringify(diagnostic)
  };

  if (formattedDiagnostic.fix) {
    formattedDiagnostic.suggestions = [buildMinimumSuggestion(formattedDiagnostic)];
  }

  return formattedDiagnostic;
}

function buildRdJsonOutput(results) {
  return {
    source: {
      name: 'ember-template-lint',
      url: 'https://github.com/ember-template-lint/ember-template-lint'
    },
    diagnostics: Object.values(results).flat().map(formatDiagnostic)
  };
}

let data = '';

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function(chunk) {
  data += chunk;
});

process.stdin.on('end', function() {
  const parsed = JSON.parse(data);
  const rdJson = buildRdJsonOutput(parsed);
  console.log(JSON.stringify(rdJson));
});
