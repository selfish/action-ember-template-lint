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
  let lnum = 1;
  let column = 0;
  let lengthSoFar = 0;
  for (const line of lines) {
    if (offset <= lengthSoFar + line.length) {
      const lineText = line.slice(0, offset-lengthSoFar);
      // +1 because eslint offset is a bit weird and will append text right
      // after the offset.
      column = utf8length(lineText) + 1;
      break;
    }
    lengthSoFar += line.length + 1; // +1 for line-break.
    lnum++;
  }
  return {line: lnum, column: column};
}

function positionFromLineAndUTF16CodeUnitOffsetColumn(line, column, sourceLines) {
  let col = 0;
  if (sourceLines.length >= line) {
    const lineText = sourceLines[line-1].slice(0, column);
    col = utf8length(lineText);
  }
  return {line: line, column: col};
}

function commonSuffixLength(str1, str2) {
  let i = 0;
  for (i = 0; i < str1.length && i < str2.length; ++i) {
    if (str1[str1.length-(i+1)] !== str2[str2.length-(i+1)]) {
      break;
    }
  }
  return i;
}

function buildMinimumSuggestion(fix, source) {
  const l = 0;//commonSuffixLength(fix.text, source.slice(fix.range[0], fix.range[1]));
  return {
    range: {
      start: {line: 0, column: 0},//positionFromUTF16CodeUnitOffset(fix.range[0], source),
      end: {line: 0, column: 1}//positionFromUTF16CodeUnitOffset(fix.range[1] - l, source)
    },
    text: fix.text.slice(0, fix.text.length - l)
  };
}

function buildRdJsonOutput(results, data) {
  const rdjson = {
    source: {
      name: 'ember-template-lint',
      url: 'https://eslint.org/'
    },
    diagnostics: []
  };

  Object.keys(results).forEach(file => {
    results[file].forEach(result => {
      const filePath = result.filePath;
      const source = result.source;
      const sourceLines = source ? source.split('\n') : [];

      let diagnostic = {
        message: result.message,
        location: {
          path: filePath,
          range: {
            start: positionFromLineAndUTF16CodeUnitOffsetColumn(result.line, result.column, sourceLines),
            end:positionFromLineAndUTF16CodeUnitOffsetColumn(result.line, result.column, sourceLines)
          }
        },
        severity: convertSeverity(result.severity),
        code: {
          value: result.rule,
          url: `https://github.com/ember-template-lint/ember-template-lint/blob/master/docs/rule/${result.rule}.md` //(data.rulesMeta[msg.rule] && data.rulesMeta[msg.rule].docs ? data.rulesMeta[msg.rule].docs.url : '')
        },
        original_output: JSON.stringify(result)
      };

      if (result.fix) {
        debugger;
        diagnostic.suggestions = [buildMinimumSuggestion(result.fix, source)];
      }

      rdjson.diagnostics.push(diagnostic);
    });
  })

  return JSON.stringify(rdjson);
};

let data = '';

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function(chunk) {
  data += chunk;
});

process.stdin.on('end', function() {
  console.log(buildRdJsonOutput(JSON.parse(data)));
});
