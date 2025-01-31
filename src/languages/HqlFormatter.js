import Formatter from '../core/Formatter';
import { isEnd, isWindow } from '../core/token';
import Tokenizer from '../core/Tokenizer';
import tokenTypes from '../core/tokenTypes';

const reservedWords = [
  'ALL',
  'ALTER',
  'ANALYSE',
  'ANALYZE',
  'ARRAY_ZIP',
  'ARRAY',
  'AS',
  'ASC',
  'AVG',
  'BETWEEN',
  'CASCADE',
  'CASE',
  'CAST',
  'COALESCE',
  'COLLECT_LIST',
  'COLLECT_SET',
  'COLUMN',
  'COLUMNS',
  'COMMENT',
  'CONSTRAINT',
  'CONTAINS',
  'CONVERT',
  'COUNT',
  'CUME_DIST',
  'CURRENT ROW',
  'CURRENT_DATE',
  'CURRENT_TIMESTAMP',
  'DATABASE',
  'DATABASES',
  'DATE_ADD',
  'DATE_SUB',
  'DATE_TRUNC',
  'DAY_HOUR',
  'DAY_MINUTE',
  'DAY_SECOND',
  'DAY',
  'DAYS',
  'DECODE',
  'DEFAULT',
  'DELETE',
  'DENSE_RANK',
  'DESC',
  'DESCRIBE',
  'DISTINCT',
  'DISTINCTROW',
  'DIV',
  'DROP',
  'ELSE',
  'ENCODE',
  'END',
  'EXISTS',
  'EXPLAIN',
  'EXPLODE_OUTER',
  'EXPLODE',
  'FILTER',
  'FIRST_VALUE',
  'FIRST',
  'FIXED',
  'FLATTEN',
  'FOLLOWING',
  'FROM_UNIXTIME',
  'FULL',
  'GREATEST',
  'GROUP_CONCAT',
  'HOUR_MINUTE',
  'HOUR_SECOND',
  'HOUR',
  'HOURS',
  'IF',
  'IFNULL',
  'IN',
  'INSERT',
  'INTERVAL',
  'INTO',
  'IS',
  'LAG',
  'LAST_VALUE',
  'LAST',
  'LEAD',
  'LEADING',
  'LEAST',
  'LEVEL',
  'LIKE',
  'MAX',
  'MERGE',
  'MIN',
  'MINUTE_SECOND',
  'MINUTE',
  'MONTH',
  'NATURAL',
  'NOT',
  'NOW()',
  'NTILE',
  'NULL',
  'NULLIF',
  'OFFSET',
  'ON DELETE',
  'ON UPDATE',
  'ON',
  'ONLY',
  'OPTIMIZE',
  'OVER',
  'PERCENT_RANK',
  'PRECEDING',
  'RANGE',
  'RANK',
  'REGEXP',
  'RENAME',
  'RLIKE',
  'ROW',
  'ROWS',
  'SECOND',
  'SEPARATOR',
  'SEQUENCE',
  'SIZE',
  'STRING',
  'STRUCT',
  'SUM',
  'TABLE',
  'TABLES',
  'TEMPORARY',
  'THEN',
  'TO_DATE',
  'TO_JSON',
  'TO',
  'TRAILING',
  'TRANSFORM',
  'TRUE',
  'TRUNCATE',
  'TYPE',
  'TYPES',
  'UNBOUNDED',
  'UNIQUE',
  'UNIX_TIMESTAMP',
  'UNLOCK',
  'UNSIGNED',
  'USING',
  'VARIABLES',
  'VIEW',
  'WHEN',
  'WITH',
  'YEAR_MONTH',
];

const reservedTopLevelWords = [
  'ADD',
  'AFTER',
  'ALTER COLUMN',
  'ALTER DATABASE',
  'ALTER SCHEMA',
  'ALTER TABLE',
  'CLUSTER BY',
  'CLUSTERED BY',
  'DELETE FROM',
  'DISTRIBUTE BY',
  'FROM',
  'GROUP BY',
  'HAVING',
  'INSERT INTO',
  'INSERT',
  'LIMIT',
  'OPTIONS',
  'ORDER BY',
  'PARTITION BY',
  'PARTITIONED BY',
  'RANGE',
  'ROWS',
  'SELECT',
  'SET CURRENT SCHEMA',
  'SET SCHEMA',
  'SET',
  'TBLPROPERTIES',
  'UPDATE',
  'USING',
  'VALUES',
  'WHERE',
  'WINDOW',
];

const reservedTopLevelWordsNoIndent = [
  'EXCEPT ALL',
  'EXCEPT',
  'INTERSECT ALL',
  'INTERSECT',
  'UNION ALL',
  'UNION',
];

const reservedNewlineWords = [
  'AND',
  'CREATE OR',
  'CREATE',
  'ELSE',
  'LATERAL VIEW',
  'OR',
  'OUTER APPLY',
  'WHEN',
  'XOR',
  // joins
  'JOIN',
  'INNER JOIN',
  'LEFT JOIN',
  'LEFT OUTER JOIN',
  'RIGHT JOIN',
  'RIGHT OUTER JOIN',
  'FULL JOIN',
  'FULL OUTER JOIN',
  'CROSS JOIN',
  'NATURAL JOIN',
  // non-standard-joins
  'ANTI JOIN',
  'SEMI JOIN',
  'LEFT ANTI JOIN',
  'LEFT SEMI JOIN',
  'RIGHT OUTER JOIN',
  'RIGHT SEMI JOIN',
  'NATURAL ANTI JOIN',
  'NATURAL FULL OUTER JOIN',
  'NATURAL INNER JOIN',
  'NATURAL LEFT ANTI JOIN',
  'NATURAL LEFT OUTER JOIN',
  'NATURAL LEFT SEMI JOIN',
  'NATURAL OUTER JOIN',
  'NATURAL RIGHT OUTER JOIN',
  'NATURAL RIGHT SEMI JOIN',
  'NATURAL SEMI JOIN',
];

export default class HqlFormatter extends Formatter {
  tokenizer() {
    return new Tokenizer({
      reservedWords,
      reservedTopLevelWords,
      reservedNewlineWords,
      reservedTopLevelWordsNoIndent,
      specialWordChars: ['$', '{', '}', '/'],
      stringTypes: [`""`, "''", '``'],
      openParens: ['(', 'CASE'],
      closeParens: [')', 'END'],
      indexedPlaceholderTypes: ['?'],
      namedPlaceholderTypes: [],
      lineCommentTypes: ['--'],
      operators: ['!=', '<=>', '&&', '||', '=='],
    });
  }

  tokenOverride(token) {
    // Fix cases where names are ambiguously keywords or functions
    if (isWindow(token)) {
      const aheadToken = this.tokenLookAhead();
      if (aheadToken && aheadToken.type === tokenTypes.OPEN_PAREN) {
        // This is a function call, treat it as a reserved word
        return { type: tokenTypes.RESERVED, value: token.value };
      }
    }

    // Fix cases where names are ambiguously keywords or properties
    if (isEnd(token)) {
      const backToken = this.tokenLookBehind();
      if (backToken && backToken.type === tokenTypes.OPERATOR && backToken.value === '.') {
        // This is window().end (or similar) not CASE ... END
        return { type: tokenTypes.WORD, value: token.value };
      }
    }

    return token;
  }

  getFormattedQueryFromTokens() {
    let formattedQuery = '';

    this.tokens.forEach((token, index) => {
      this.index = index;

      token = this.tokenOverride(token);

      if (token.type === tokenTypes.LINE_COMMENT) {
        formattedQuery = this.formatLineComment(token, formattedQuery);
      } else if (token.type === tokenTypes.BLOCK_COMMENT) {
        formattedQuery = this.formatBlockComment(token, formattedQuery);
      } else if (token.type === tokenTypes.RESERVED_TOP_LEVEL) {
        formattedQuery = this.formatTopLevelReservedWord(token, formattedQuery);
        this.previousReservedToken = token;
      } else if (token.type === tokenTypes.RESERVED_TOP_LEVEL_NO_INDENT) {
        formattedQuery = this.formatTopLevelReservedWordNoIndent(token, formattedQuery);
        this.previousReservedToken = token;
      } else if (token.type === tokenTypes.RESERVED_NEWLINE) {
        formattedQuery = this.formatNewlineReservedWord(token, formattedQuery);
        this.previousReservedToken = token;
      } else if (token.type === tokenTypes.RESERVED) {
        formattedQuery = this.formatWithSpaces(token, formattedQuery);
        this.previousReservedToken = token;
      } else if (token.type === tokenTypes.OPEN_PAREN) {
        formattedQuery = this.formatOpeningParentheses(token, formattedQuery);
      } else if (token.type === tokenTypes.CLOSE_PAREN) {
        formattedQuery = this.formatClosingParentheses(token, formattedQuery);
      } else if (token.type === tokenTypes.PLACEHOLDER) {
        formattedQuery = this.formatPlaceholder(token, formattedQuery);
      } else if (token.value === ',') {
        formattedQuery = this.formatComma(token, formattedQuery);
      } else if (token.value === '.' || token.value === ':') {
        formattedQuery = this.formatWithoutSpaces(token, formattedQuery);
      } else if (token.value === ';') {
        formattedQuery = this.formatQuerySeparator(token, formattedQuery);
      } else {
        formattedQuery = this.formatWithSpaces(token, formattedQuery);
      }
    });
    return formattedQuery;
  }
}
