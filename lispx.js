;
(function (window) {
	
	var lispx = { },
		lex, parse, symbols, leftFold;
	
	foldLeft = function (list, init,  lambda) {
		var i;
		for (i = 0; i < list.length; i++) {
			init = lambda(init, list[i]);
		}
		return init;
	};
	
	
	// macros: 
	// input: list of their tail
	// output: new list
	macros = { };
	macros['def'] = function (tail) {
		if (arguments.length !== 1) {
			throw 'def requires exactly two arguments.';
		}
		return [
			function () { 
				if (arguments.length !== 1) {
					throw 'invalid argument count for def.';
				}
				symbols[tail[0]] = arguments[0];
				return arguments[0];
			},
			tail[1]
		];
	};
	
	// built in symbols
	symbols = { };
	
	symbols['def'] = function () {
		if (arguments.length !== 2) {
			throw 'let requires exactly two arguments';
		}
		symbols[arguments[0]] = evaluate(arguments[1]);
	};
	
	symbols['head'] = function () {
		if (arguments.length !== 1 || !Array.isArray || Array.isArray(arguments[0])) {
			throw 'head requires one list as an argument';
		}
		return arguments[0][0];
	};
	symbols['tail'] = function () {
		if (arguments.length !== 1 || !Array.isArray || Array.isArray(arguments[0])) {
			throw 'tail requires one list as an argument';
		}
		return arguments[0].slice(1);
	};
	symbols['last'] = function () {
		if (arguments.length !== 1 || !Array.isArray || Array.isArray(arguments[0])) {
			throw 'last requires one list as an argument';
		}
		return arguments[arguments.length - 1];
	};
	symbols['front'] = function () {
		if (arguments.length !== 1 || !Array.isArray || Array.isArray(arguments[0])) {
			throw 'head requires one list as an argument';
		}
		return arguments.slice(0, arguments.length - 1);
	};
	
	symbols['+'] = function () {
		if (arguments.length < 2) {
			throw '\'+\' requires at least two arguments.'; 
		}
		
		// work for strings or numbers...
		if (typeof arguments[0] === 'string') {
			return '"' + foldLeft(arguments, '', function (a, b) { return a + b.substring(1, b.length - 1); }) + '"';
		}
		return foldLeft(arguments, 0, function (a, b) { return a + b; });
	};
	symbols['-'] = function () {
		if (arguments.length < 2) {
			throw '\'-\' requires exactly two arguments.'; 
		}
		return arguments[0] - arguments[1];
	};
	symbols['*'] = function () {
		if (arguments.length < 2) {
			throw '\'*\' requires at least two arguments.'; 
		}
		return foldLeft(arguments, 1, function (a, b) { return a * b; });
	};
	symbols['/'] = function () {
		if (arguments.length < 2) {
			throw '\'/\' requires exactly two arguments.'; 
		}
		return arguments[0] / arguments[1];
	};
	
	
	// input: string of lisp code
	// output: list of tokens
	lex = function (source) {
		var tokens = [],
			STATE = {
				NORMAL: 0,
				DOUBLE_QUOTE_STRING: 1,
				SINGLE_QUOTE_STRING: 2
			},
			whitespace = /^\s$/i,
			currentToken = '',
			currentState = STATE.NORMAL,
			currentIndex, currentChar;
		
		if (typeof source !== 'string') {
			throw 'input must be of type string';
		}
		
		for (currentIndex = 0; currentIndex < source.length; currentIndex++) {
			currentChar = source[currentIndex];
			
			switch(currentState) {
				
				case STATE.NORMAL:
				
					if (currentChar === '(' || currentChar === ')') {
						if (currentToken !== '') {
							tokens.push(currentToken);
						}
						tokens.push(currentChar);
						currentToken = '';
						continue;
					}
					
					if (whitespace.test(currentChar)) {
						if (currentToken !== '') {
							tokens.push(currentToken);
							currentToken = '';
						}
						continue;
					}
					
					if (currentChar === '"') {
						currentState = STATE.DOUBLE_QUOTE_STRING;
					}
					else if (currentChar === "'") {
						currentState = STATE.SINGLE_QUOTE_STRING;
					}
					currentToken += currentChar;
					break;
			
				
				case STATE.DOUBLE_QUOTE_STRING:
					currentToken += currentChar;
					if (currentChar === '"' && currentToken.length > 0 && currentToken[currentToken.length - 1] !== '\\') {
						tokens.push(currentToken);
						currentToken = '';
						currentState = STATE.NORMAL;
					}
					break;
				
				case STATE.SINGLE_QUOTE_STRING:
					currentToken += currentChar;
					if (currentChar === "'" && currentToken.length > 0 && currentToken[currentToken.length - 1] !== '\\') {
						tokens.push(currentToken);
						currentToken = '';
						currentState = STATE.NORMAL;
					}
					break;
			}
		}
		
		if (currentToken !== '') {
			tokens.push(currentToken);
		}
		
		return tokens;
	};
 
 
	// input: list of tokens
	// output: syntax tree
	// errors: thrown on syntax violations
	parse = function (tokens) {
		
		var expressions = [],
			expressionStack = [],
			currentExpression = null, 
			tokenIndex, currentToken, prevExpression;
		
		if (Array.isArray && !Array.isArray(tokens)) {
			throw 'input must be an array of tokens';
		}
		
		for (tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
			currentToken = tokens[tokenIndex];
			
			if (currentExpression === null) {
				if (currentToken === ')') {
					throw 'Illegal \')\' encountered';
				}
				if (currentToken !== '(') {
					expressions.push(currentToken);
					continue;
				}
				// else, currentToken === '('
				currentExpression = [];
				continue;
			}
			
			// expression already being built
			if (currentToken === '(') {
				expressionStack.push(currentExpression);
				currentExpression = [];
				continue;
			}
			
			if (currentToken === ')') {
				if (expressionStack.length === 0) {
					expressions.push(currentExpression);
					currentExpression = null;
					continue;
				}
				
				prevExpression = expressionStack.pop();
				prevExpression.push(currentExpression);
				currentExpression = prevExpression;
				prevExpression = null;
				continue;
			}
			
			// else, regular token...
			currentExpression.push(currentToken);
		}
		
		if (expressionStack.length !== 0 || currentExpression !== null) {
			throw 'Missing \')\'';
		}
		
		return expressions;
	};
	
	
	// input: syntax tree
	// output: syntax tree w/ macros expanded
	function macroExpand(syntaxTree) {
		var i;
		
		for (i = 0; i < syntaxTree.length; i++) {
			if (Array.isArray(syntaxTree[i])) {
				syntaxTree[i] = macroExpand(syntaxTree[i]);
			}
		}
		
		if (syntaxTree.length > 0 && typeof macros[syntaxTree[0]] === 'function') {
			return macros[syntaxTree[0]](syntaxTree.splice(1));
		}
		return syntaxTree;
	};
	
	
	function isFunction (token) {
		// macros generated functions:
		if (typeof token === 'function') {
			return true;
		}
		
		// regular lisp functions:
		if (typeof symbols[token] === 'function') {
			return true;
		}
		
		// DOM/JS functions
		// TODO: alternative to this to access DOM API
		try {
			if (typeof eval(token) === 'function') {
				return true;
			}
		}
		catch (e) {
			return false;
		}
		return false;
	}
	
	function applyFunction (token, args) {
		// macro generated function
		if (typeof token === 'function') {
			return token.apply(null, args);
		}
		
		// lisp function: 
		if (typeof symbols[token] === 'function') {
			return symbols[token].apply(null, args);
		}
		
		/// 'native' function
		// TODO: fix 'this' scoping, dont use eval if possible... native function translation
		return eval(token+'.apply(null, args)');
	}
	
	function isLispNumber(val) {
		if (!isNaN(Number(val))) {
			return true;
		}
		return false;
	}
	
	function isLispString(val) {
		var first, last;
		
		if (typeof val !== 'string') {
			return false;
		}
		
		first = val.substring(0, 1);
		last = val.substring(val.length - 1);
		
		if (first === '"' && last === '"') {
			return true;
		}
		if (first === "'" && last === "'") {
			return true;
		}
		
		return false;
	}
	
	
	// input: parsed syntax tree of the source code
	// output: list of evaluated expressions
	// strategy: look at first element in each list.  if a function, evaluate sub-pieces, then evaluate whole
	function evaluate (syntaxTree) {
		var index = 0,
			num, symbolType;
		
		if (!Array.isArray(syntaxTree)) {
			// number, string, or variable
			if (isLispNumber(syntaxTree)) {
				return Number(syntaxTree);
			}
			
			if (isLispString(syntaxTree)) {
				return syntaxTree;
			}
			
			if (!symbols[syntaxTree]) {
				throw 'Unable to evaluate \'' + syntaxTree + '\'';
			}	
			
			symbolType = typeof symbols[syntaxTree];
			if (symbolType === 'function') {
				return 'lambda object';
			}
			if (Array.isArray(symbols[syntaxTree]) || symbolType !== 'object') {
				return symbols[syntaxTree];
			}
			
			throw 'Unable to evaluate...';
		}
		
		if (syntaxTree.length === 0) {
			return syntaxTree;
		}
		
		if (isFunction(syntaxTree[0])) {
			index = 1;
		}
		
		for (index; index < syntaxTree.length; index++) {
			syntaxTree[index] = evaluate(syntaxTree[index]);
		}
		
		if (isFunction(syntaxTree[0])) {
			return applyFunction(syntaxTree[0], syntaxTree.slice(1));
		}
		return syntaxTree;
	};
	
	
	// input: a JS list
	// output: a Lisp formatted list.
	function output (val) {
		var result = '', i;
		
		if (!Array.isArray(val)) {
			return val.toString();
		}
		
		result = '('; 
		for (i = 0; i < val.length; i++) {
			result += output(val[i]);
			if (i !== val.length - 1) {
				result += ' ';
			}
		}
		
		result += ')';
		return result;
	};
	
	
	
	// Public interface: 
	
	// input: some lisp code
	// output: the result of the last expression in the code
	lispx.execute = function (input) {
		var lexed, parsed, expanded, evaluated, display;
		
		try {
			lexed = lex(input);
		}
		catch (e) {
			return 'Lex Error: ' + e;
		}
		
		try {
			parsed = parse(lexed);
		} 
		catch (e) {
			return 'Parse Error: ' + e;
		}
		
		try {
			expanded = macroExpand(parsed);
		}
		catch (e) {
			return 'Macro Expansion Error: ' + e;
		}
		
		try {
			evaluated = evaluate(expanded);
		}
		catch (e) {
			return 'Evaluation Error: ' + e;
		}
		
		try {
			display = output(evaluated[evaluated.length - 1]);
		}
		catch (e) {
			return 'Output Error: ' + e;
		}
		
		return display;
	};
	
	window.LISPX = lispx;
	
 }(window));